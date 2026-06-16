import logging
import json
import subprocess
import time
import math
import hashlib
import hmac
from dataclasses import dataclass

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
from synapse.http.server import respond_with_json, respond_with_json_bytes
from synapse.storage.engines import PostgresEngine, Sqlite3Engine

try:
    import conf.modules.pseudonyms
except:
    pass # TODO

# Composite post-quantum HHPP verification (ML-DSA-65 + Ed25519).
from ._hhpp import (
    BESPOKE_ALG,
    HhppStatus,
    check_hhpp,
    parse_verifying_key,
)
from ._base64url import b64url_decode, b64url_encode


logger = logging.getLogger("synapse.contrib." + __name__)

# Module that adds some of the core pubhubs functionality:
#   - version number metrics
#   - the '_synapse/client/.ph/' endpoints


@dataclass
class Config:
    phc_url: str = None
    hub_client_url: str = None
    hub_info_update_interval: int = 60

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

        # The database engine synapse is actually connected through this boot, so we can
        # track which hubs have completed the sqlite3 -> postgres migration ('postgres')
        # and which are still on (or deferring to) sqlite3 ('sqlite3').  Must match the
        # rust enum api::hub::DatabaseEngine: 'sqlite3', 'postgres' or 'unknown'.
        engine = self._api._store.db_pool.engine
        if isinstance(engine, PostgresEngine):
            database_engine = 'postgres'
        elif isinstance(engine, Sqlite3Engine):
            database_engine = 'sqlite3'
        else:
            database_engine = 'unknown'

        # [Endpoints]
        hub_info = {
                    'hub_version': version_string,
                    'database_engine': database_engine,
                    'dynamic': { 'last_reload': 0 }
        }

        if self._config != None:
            hub_info['hub_client_url'] = self._config.hub_client_url

        api.register_web_resource('/_synapse/client/.ph/info', PhInfoEP({ 'Ok': hub_info }, self._config.hub_info_update_interval))

        # new, multi-server setup
        if self._config == None:
            return

        self._secret_box = nacl.secret.Aead(nacl.utils.random(nacl.secret.Aead.KEY_SIZE))

        api.register_web_resource('/_synapse/client/.ph/enter-start', PhEnterStartEP(self))
        api.register_web_resource('/_synapse/client/.ph/enter-complete', PhEnterCompleteEP(self))
        self._constellation = None
        self._hub_id = None # b64url hub id, set by get_constellation; needed to verify the hub-id mac
        self._constellation_last_update_triggered = 0
        self._phc_verifying_key = None # CompositeKey, set by get_constellation
        self.trigger_get_constellation()

    @staticmethod
    def parse_config(config):
        if 'phc_url' not in config:
            logger.warn("pubhubs core module: phc_url not configured - not enabling multi-server setup endpoints")
            return None

        return Config(
                phc_url = config['phc_url'],
                hub_client_url = config.get('hub_client_url'),
                hub_info_update_interval = config.get('hub_info_update_interval', Config.hub_info_update_interval))

    def trigger_get_constellation(self):
        now = time.time()
        # anyone can trick a hub into checking whether its constellation is up-to-date,
        # so we do not remove the old constellation until we've gotten the new one,
        # and we don't fire an unlimited amount of requests:
        if now - self._constellation_last_update_triggered < 3: # TODO: make configurable
            logger.info("not triggering update of constellation yet")
            return
        self._constellation_last_update_triggered = now
        # in its own logcontext (logs its own failures); a bare ensureDeferred here would leak the
        # calling request's logcontext into the reactor, killing synapse's looping calls
        self._api.run_as_background_process("get_constellation", self.get_constellation)

    async def get_constellation(self):
        url = urljoin(self._config.phc_url, ".ph/user/welcome")
        logger.info(f"requesting {url}")
        try:
            resp = await self._api.http_client.get_json(url)
        except Exception as e:
            # expected now and then (e.g. PHC not yet up when we boot); retriggered on demand
            logger.warn(f"could not retrieve constellation from {url}: {e}")
            return
        assert("Ok" in resp)
        ok_json = resp['Ok']
        assert("constellation" in ok_json)
        constellation = ok_json['constellation']

        # PHC's composite verifying key {ed, ml} (standard base64), used to verify the HHPP.
        # Parse before committing the constellation, so a refresh that lacks/garbles the key keeps
        # the previous working constellation+key instead of wiping it.  Missing/malformed is logged,
        # not fatal (it should be present, since hubs upgrade after the central servers).
        vk = constellation.get('phc_verifying_key')
        if vk is None:
            logger.error("constellation lacks phc_verifying_key; PHC too old to verify composite HHPP")
            return
        try:
            phc_verifying_key = parse_verifying_key(vk)
        except Exception as e:
            logger.error(f"could not parse phc_verifying_key for composite HHPP verification: {e}")
            return

        self._constellation = constellation
        self._phc_verifying_key = phc_verifying_key
        logger.info(f"retrieved constellation with id {self._constellation['id']}")

        # Resolve our own hub id (to verify the hub-id mac in enter-complete) from PHC's advertised
        # hubs, matching our public_baseurl against the hub urls (ignoring paths: PHC advertises
        # the hub server url with the /_synapse/client/ path attached).
        my_url = normalize_hub_url(self._api.public_baseurl)
        ids = [h['id'] for h in ok_json['hubs'].values() if normalize_hub_url(h['url']) == my_url]
        if len(ids) != 1:
            logger.error(f"cannot resolve our hub id: expected exactly one advertised hub at {my_url} "
                         f"(our public_baseurl, {self._api.public_baseurl}), found {len(ids)}; "
                         "is public_baseurl set to the url this hub is registered with at PHC?")
            return
        if self._hub_id is not None and ids[0] != self._hub_id:
            logger.critical(f"our hub id changed from {self._hub_id} to {ids[0]}! the hub id must never change; "
                            "keeping the old id, so logins will fail closed (a restart would adopt the new id)")
            return
        if self._hub_id is None:
            logger.info(f"resolved our hub id: {ids[0]}")
        self._hub_id = ids[0]

def normalize_hub_url(url):
    """Reduces a url to lowercased scheme://host:port, dropping any path, so a hub's
    public_baseurl and the url PHC advertises for it compare equal.  Otherwise exact by design
    (no default-port/trailing-dot canonicalization): the strict host:port match also catches a
    public_baseurl that disagrees with what PHC has registered."""
    parts = urlparse(url)
    return f"{parts.scheme}://{parts.netloc}".lower()

def get_version_string():
    try:
        return Path('hub_version').read_text().strip()
    except FileNotFoundError as e:
        logger.warn(f"Could not obtain hub version: {e}")
        return "n/a runtime"

class PhInfoEP(Resource):
    def __init__(self, contents, update_interval):
        self._contents = contents
        self._contents_bytes = None
        self._update_interval = update_interval
        self.update_contents()

    def update_contents(self):
        # See HubClientApiConfig.py
        try: 
            with open('/data/media/hub_settings', 'rb') as f:
                self._contents['Ok']['dynamic']['settings'] = json.load(f)
        except FileNotFoundError:
            with open('/non-persistent-data/assets/default_hub_settings.json', 'rb') as f:
                self._contents['Ok']['dynamic']['settings'] = json.load(f)
        self._contents['Ok']['dynamic']['last_reload'] = math.floor(time.time())
        self._contents_bytes = json.dumps(self._contents).encode('ascii')

    def render_GET(self, request):
        if time.time() - self._contents['Ok']['dynamic']['last_reload'] > self._update_interval:
            self.update_contents()
        return respond_with_json_bytes(request, 200, self._contents_bytes, send_cors=True)

class PhEnterStartEP(Resource):
    def __init__(self, core):
        self._core = core

    def render_POST(self, request):
        # binds nonce and state
        random = b64url_encode(nacl.utils.random(32))
        # per-session key the transcryptor macs our hub id with; recovered from the state in enter-complete
        mac_key = b64url_encode(nacl.utils.random(32))

        state = b64url_encode(self._core._secret_box.encrypt(json.dumps({
            'random': random,
            'iat': time.time(),
            'mac_key': mac_key,
        }).encode('ascii'), b"state"))

        nonce = b64url_encode(self._core._secret_box.encrypt(json.dumps({
            'random': random
        }).encode('ascii'), b"nonce"))

        # Tell PHC to sign the HHPP with the bespoke composite scheme.  (We accept the standard
        # scheme too, but the backend only produces the bespoke one for now.)  Rollout order is
        # central servers first, then hubs, so PHC already understands this field.
        return respond_with_json(request, 200, { 'Ok': {
                'state': state,
                'nonce': nonce,
                'hhpp_signature_scheme': BESPOKE_ALG,
                'hub_mac_key': mac_key,
            }}, send_cors=True)

def bad_request():
    return { 'Err': 'BadRequest' }

def internal_error():
    return { 'Err': 'InternalError' }

def please_retry():
    return { 'Err': 'PleaseRetry' }

def verify_hub_id_mac(own_hub_id, mac_key, hub_id_mac):
    """Whether hub_id_mac == HMAC-SHA256(mac_key, own_hub_id); all args unpadded-base64url strings."""
    expected = hmac.new(b64url_decode(mac_key), b64url_decode(own_hub_id), hashlib.sha256).digest()
    return hmac.compare_digest(expected, b64url_decode(hub_id_mac))


class PhEnterCompleteEP(Resource):
    def __init__(self, core):
        self._core = core

    def render_POST(self, request):
        d = twisted.internet.defer.ensureDeferred(self._render_POST_async(request))
        d.addCallback(lambda result: self._finish_request(request, result))
        d.addErrback(lambda failure: self._finish_on_error(request, failure))
        return NOT_DONE_YET

    def _finish_request(self, request, result):
        respond_with_json(request, 200, result, send_cors=True)

    def _finish_on_error(self, request, failure):
        logger.error(f"unhandled error in enter-complete: {failure.getTraceback()}")
        self._finish_request(request, internal_error())

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
            state = json.loads(self._core._secret_box.decrypt(b64url_decode(state_str), b"state"))
        except Exception as e:
            logger.warn(f"invalid state passed to enter complete endpoint: {e}")
            return bad_request()
        
        if not isinstance(state, dict) or "random" not in state or "iat" not in state or "mac_key" not in state:
            logger.error("missing fields in enter state")
            return internal_error()

        state_random = state['random']
        state_iat = state['iat']

        # Only access enter states not older than 10 seconds. (TODO: make configurable)
        if time.time() - state_iat > 10: 
            logger.info("expired enter state submitted")
            return { 'Ok': 'RetryFromStart' }

        # check_hhpp does the signature check plus the message-code/constellation/expiry routing and
        # the our/their-fault split; we only map each status to a response, refetching the
        # constellation (rate-limited) on the statuses where we might be the stale side.
        result = check_hhpp(hhpp, self._core._phc_verifying_key, self._core._constellation)
        match result.status:
            case HhppStatus.OUR_CONSTELLATION_STALE:
                self._core.trigger_get_constellation()
                return please_retry()
            case HhppStatus.CONSTELLATIONS_DIVERGED:
                # can't tell who is behind: catch up in case it's us, and have the client start over
                self._core.trigger_get_constellation()
                return { 'Ok': 'RetryFromStart' }
            case HhppStatus.THEIR_CONSTELLATION_STALE | HhppStatus.EXPIRED:
                # the client must obtain a fresh HHPP (theirs was signed by an old key, or aged out)
                return { 'Ok': 'RetryFromStart' }
            case HhppStatus.OTHERWISE_INVALID:
                return bad_request()
            case HhppStatus.MISMINTED:
                return internal_error()
            case HhppStatus.VERIFIED:
                claims = result.claims
            case _:
                raise AssertionError(f"unhandled hhpp status {result.status}")

        if not 'hub_nonce' in claims or 'pp_issued_at' not in claims or 'hashed_hub_pseudonym' not in claims:
            logger.error("missing fields in hhpp")
            return internal_error()

        pp_issued_at = claims['pp_issued_at']
        nonce_str = claims['hub_nonce']
        hhp = claims['hashed_hub_pseudonym']

        if not isinstance(pp_issued_at, int) or isinstance(pp_issued_at, bool):
            # pp_issued_at is a NumericDate (a u64); a non-integer means PHC misminted the hhpp
            logger.error("misminted hhpp: non-integer pp_issued_at")
            return internal_error()

        if time.time() - pp_issued_at > 10: # TODO: make configurable
            logger.info("hhpp from pp that was issued too long ago")
            return { 'Ok': 'RetryFromStart' }

        try:
            nonce = json.loads(self._core._secret_box.decrypt(b64url_decode(nonce_str), b"nonce"))
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

        # Verify the transcryptor pseudonymised for *this* hub: recompute the hub-id mac over our own id
        # with the per-session key from our state, and reject a mismatch (a client that requested a
        # different hub's factor).  Fail closed.
        if self._core._hub_id is None:
            # not resolved yet (e.g. PHC hadn't listed us at startup); refetch and have the client retry
            self._core.trigger_get_constellation()
            return please_retry()

        if 'hub_id_mac' not in claims:
            logger.warn("hhpp lacks the hub-id mac (stale or non-compliant client)")
            return bad_request()

        if not verify_hub_id_mac(self._core._hub_id, state['mac_key'], claims['hub_id_mac']):
            logger.warn("hub-id mac mismatch: transcryptor pseudonymised for a different hub")
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

            mxid = await conf.modules.pseudonyms.register_under_fresh_pseudonym(
                longlocalpart,
                lambda localpart: self._core._api.register_user(localpart, localpart, None, False),
            )

            await self._core._api.record_user_external_id("pubhubs", hhp, mxid)
            logger.info(f"registered {mxid} for {hhp}")

        (device_id, access_token, access_token_exp, refresh_token) = await self._core._api.register_device(mxid)

        return { 'Ok': { 'Entered': {
                'access_token': access_token,
                'device_id': device_id,
                'new_user': new_user,
                'mxid': mxid,
            }}}
