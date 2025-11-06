import logging
import json
import subprocess
import base64
import time
from dataclasses import dataclass

import authlib.jose
from pathlib import Path
from urllib.parse import urlparse, urljoin
from  urllib.request import urlopen

import nacl
import nacl.utils
import nacl.secret

from twisted.web.resource import Resource
from twisted.web.server import NOT_DONE_YET
import twisted.internet.defer


from prometheus_client import Gauge

from synapse.module_api import ModuleApi
from synapse.http.server import respond_with_json
import synapse.api.errors

try:
    import conf.modules.pseudonyms
except:
    pass # TODO


logger = logging.getLogger("synapse.contrib." + __name__)

# Module that adds some of the core pubhubs functionality:
#   - version number metrics
#   - the '_synapse/client/.ph/' endpoints 

@dataclass
class Config:
    phc_url: str = None
    hub_client_url: str = None

class Core:
    def __init__(self, config: dict, api: ModuleApi):
        self._config = config
        self._api = api

        version_string = get_version_string()

        # [Metrics] Adds hub build information prometheus gauge
        # C.f. https://github.com/element-hq/synapse/blob/13dea6949bee2820632d4937beee98434bac9a8c
        #                        /synapse/metrics/__init__.py#L421
        build_info = Gauge(
                "pubhubs_hub_build_info", "Pubhubs hub build information", ["version"]
            )

        build_info.labels(
            # version
            version_string
            ).set(1)

        # [Endpoints] 
        hub_info = { 'hub_version': version_string }
        api.register_web_resource('/_synapse/client/.ph/info', PhInfoEP({ 'Ok': hub_info }))

        # new, multi-server setup
        if self._config == None:
            return

        hub_info['hub_client_url'] = self._config.hub_client_url

        self._secret_box = nacl.secret.Aead(nacl.utils.random(nacl.secret.Aead.KEY_SIZE))

        api.register_web_resource('/_synapse/client/.ph/enter-start', PhEnterStartEP(self))
        api.register_web_resource('/_synapse/client/.ph/enter-complete', PhEnterCompleteEP(self))
        self._constellation = None
        self._constellation_last_update_triggered = 0
        self._phc_jwt_key = None # set by get_constellation
        self.trigger_get_constellation()

    @staticmethod
    def parse_config(config):
        if 'phc_url' not in config:
            logger.warn("pubhubs core module: phc_url not configured - not enabling multi-server setup endpoints")
            return None

        return Config(
                phc_url = config['phc_url'],
                hub_client_url = config.get('hub_client_url'))

    def trigger_get_constellation(self):
        now = time.time()
        # anyone can trick a hub into checking whether its constellation is up-to-date,
        # so we do not remove the old constellation until we've gotten the new one,
        # and we don't fire an unlimited amount of requests:
        if now - self._constellation_last_update_triggered < 3: # TODO: make configurable
            logger.info("not triggering update of constellation yet")
            return
        self._constellation_last_update_triggered = now
        twisted.internet.defer.ensureDeferred(self.get_constellation())

    async def get_constellation(self):
        url = urljoin(self._config.phc_url, ".ph/user/welcome")
        logger.info(f"requesting {url}")
        resp = await self._api.http_client.get_json(url)
        assert("Ok" in resp)
        ok_json = resp['Ok']
        assert("constellation" in ok_json)
        self._constellation = ok_json['constellation']
        logger.info(f"retrieved constellation with id {self._constellation['id']}")

        self._phc_jwt_key = authlib.jose.JsonWebKey.import_key({
            'kty': 'OKP',
            'alg': 'EdDSA',
            'crv': 'Ed25519',
            'x': b64enc(bytes.fromhex(self._constellation['phc_jwt_key'])),
            'use': 'sig',
        })

def get_version_string():
    try:
        return Path('hub_version').read_text().strip()
    except FileNotFoundError as e:
        logger.warn(f"Could not obtain hub version: {e}")
        return "n/a runtime"

class PhInfoEP(Resource):
    def __init__(self, contents):
        self._contents = contents

    def render_GET(self, request):
        return respond_with_json(request, 200, self._contents, send_cors=True)

class PhEnterStartEP(Resource):
    def __init__(self, core):
        self._core = core

    def render_POST(self, request):
        # binds nonce and state
        random = b64enc(nacl.utils.random(32))

        state = b64enc(self._core._secret_box.encrypt(json.dumps({
            'random': random,
            'iat': time.time()
        }).encode('ascii'), b"state"))

        nonce = b64enc(self._core._secret_box.encrypt(json.dumps({
            'random': random
        }).encode('ascii'), b"nonce"))

        return respond_with_json(request, 200, { 'Ok': {
                'state': state,
                'nonce': nonce,
            }}, send_cors=True)

def b64enc(some_bytes):
    return base64.urlsafe_b64encode(some_bytes).decode('ascii').strip('=')

def b64dec(some_string):
    return base64.urlsafe_b64decode(some_string + "==") # python requires padding

def bad_request():
    return { 'Err': 'BadRequest' }

def internal_error():
    return { 'Err': 'InternalError' }

def please_retry():
    return { 'Err': 'PleaseRetry' }


class Return(Exception):
    def __init__(self, return_value):
        self._return_value = return_value

class PhEnterCompleteEP(Resource):
    def __init__(self, core):
        self._core = core

    def render_POST(self, request):
        d = twisted.internet.defer.ensureDeferred(self._render_POST_async(request))
        d.addCallback(lambda result: self._finish_request(request, result))
        return NOT_DONE_YET

    def _finish_request(self, request, result):
        respond_with_json(request, 200, result, send_cors=True)

    def _get_phc_jwt_key(self, header, payload):
        if self._core._constellation == None:
            logger.warning("constellation suddenly became None")
            raise Return(please_retry())

        # check that our constellation if up-to-date
        if 'ph-ci' not in payload or 'c' not in payload['ph-ci'] or 'i' not in payload['ph-ci']:
            raise Return(bad_request())
        
        their_c = payload['ph-ci']['c']
        their_i = payload['ph-ci']['i']

        our_c = self._core._constellation['created_at']
        our_i = self._core._constellation['id']

        if our_c < their_c:
            logger.info("constellation out of date")
            self._core.trigger_get_constellation()
            raise Return(please_retry())
        if their_c < our_c:
            # signed by old key
            raise Return({ 'Ok': 'RetryFromStart' })
        if our_i != their_i:
            logger.info("constellation maybe out of date")
            self._core.trigger_get_constellation()
            raise Return({ 'Ok': 'RetryFromStart' })

        return self._core._phc_jwt_key

    async def _render_POST_async(self, request):
        try:
            r = json.load(request.content)
        except Exception as e:
            logger.warn(f"invalid json passed to enter complete endpoint: {e}")
            return bad_request()
    
        if not isinstance(r, dict) or "hhpp" not in r or "state" not in r:
            return bad_request()
            
        hhpp = r['hhpp']
        state_str = r['state']

        try:
            state = json.loads(self._core._secret_box.decrypt(b64dec(state_str), b"state"))
        except Exception as e:
            logger.warn(f"invalid state passed to enter complete endpoint: {e}")
            return bad_request()
        
        if not isinstance(state, dict) or "random" not in state or "iat" not in state:
            logger.error("missing fields in enter state")
            return internal_error()

        state_random = state['random']
        state_iat = state['iat']

        # Only access enter states not older than 10 seconds. (TODO: make configurable)
        if time.time() - state_iat > 10: 
            logger.info("expired enter state submitted")
            return { 'Ok': 'RetryFromStart' }

        if self._core._constellation == None:
            self._core.trigger_get_constellation();
            return please_retry()

        try:
            claims = authlib.jose.jwt.decode(hhpp, self._get_phc_jwt_key)
        except Return as re: 
            # 'Return' is raised by _get_phc_jwt_key when something is wrong with the 
            # constellation
            return re._return_value

        claims.validate() # TODO: test that this validates exp, nbf

        if 'ph-mc' not in claims or claims['ph-mc'] != 11:
            logger.warn("request with wrong message code submitted")
            return bad_request()

        if not 'hub_nonce' in claims or 'pp_issued_at' not in claims or 'hashed_hub_pseudonym' not in claims:
            logger.error("missing fields in hhpp")
            return internal_error()

        pp_issued_at = claims['pp_issued_at']
        nonce_str = claims['hub_nonce']
        hhp = claims['hashed_hub_pseudonym']

        if time.time() - pp_issued_at > 10: # TODO: make configurable
            logger.info("hhpp from pp that was issued too long ago")
            return { 'Ok': 'RetryFromStart' }

        try:
            nonce = json.loads(self._core._secret_box.decrypt(b64dec(nonce_str), b"nonce"))
        except Exception as e:
            logger.warn(f"invalid nonce passed to enter complete endpoint: {e}")
            return bad_request()
        
        if not isinstance(nonce, dict) or "random" not in nonce:
            logger.error("missing fields in enter nonce")
            return internal_error()

        nonce_random = nonce['random']

        if nonce_random != state_random:
            logger.warn("mismatch between enter nonce and state")
            return bad_request()

        logger.info(f"enter user with hashed hub pseudonym {hhp}")

        mxid = await self._core._api._store.get_user_by_external_id("pubhubs", hhp)
        new_user = False
        
        if mxid == None:
            new_user = True
            # user does not exist - create one

            # we don't base the localpart of the matrix ID on the local pseudonym, because:
            #  (1) this way, PHC cannot depseudonymize a matrix user without the help of the hub
            #  (2) this makes migrations easier
            longlocalpart = nacl.utils.random(32).hex()

            for localpart in conf.modules.pseudonyms.PseudonymHelper.short_pseudonyms(longlocalpart):
                try:
                    mxid = await self._core._api.register_user(localpart, localpart, None, False)
                    break
                except synapse.api.errors.SynapseError as err:
                    if err.errcode == synapse.api.errors.Codes.USER_IN_USE:
                        length += 1
                        continue
                    raise err
            else:
                raise RuntimeError("random pseudonym already taken (!?) ")

            await self._core._api.record_user_external_id("pubhubs", hhp, mxid)
            logger.info(f"registered {mxid} for {hhp}")

        (device_id, access_token, access_token_exp, refresh_token) = await self._core._api.register_device(mxid)

        return { 'Ok': { 'Entered': {
                'access_token': access_token,
                'device_id': device_id,
                'new_user': new_user,
                'mxid': mxid,
            }}}
