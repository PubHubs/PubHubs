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
from synapse.types import create_requester

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
from ._store import HubStore
from ._native_app import set_own_hub_id


logger = logging.getLogger("synapse.contrib." + __name__)

# Module that adds some of the core pubhubs functionality:
#   - version number metrics
#   - the '_synapse/client/.ph/' endpoints


@dataclass
class Config:
    phc_url: str = None
    hub_client_url: str = None
    hub_info_update_interval: int = 60
    deleted_accounts_poll_interval: int = 300


# `Core._deleted_pseudonyms_since` before it is read from the database, where None means
# "from the start".
_NOT_LOADED = object()

# How many polling rounds in a row an account may fail to deactivate before
# `deactivate_deleted` skips it.
MAX_DEACTIVATION_ATTEMPTS = 5


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

        # Only needed to clear a deactivated user's rows; the tables themselves are created
        # by HubClientApi.
        self._store = HubStore(api, self._config)

        api.register_web_resource('/_synapse/client/.ph/enter-start', PhStartEP(self, ENTER))
        api.register_web_resource('/_synapse/client/.ph/enter-complete', PhEnterCompleteEP(self))
        api.register_web_resource('/_synapse/client/.ph/deactivate-start', PhStartEP(self, DEACTIVATE))
        api.register_web_resource('/_synapse/client/.ph/deactivate-complete', PhDeactivateCompleteEP(self))
        self._constellation = None
        self._hub_id = None # b64url hub id, set by get_constellation; needed to verify the hub-id mac
        self._constellation_last_update_triggered = 0
        self._phc_verifying_key = None # CompositeKey, set by get_constellation
        self.trigger_get_constellation()
        # Keep trying until our hub id is known (e.g. PHC was not up yet when we booted): the native
        # app's CORS origins depend on it, and a user with a saved access token never goes through
        # enter-complete, which would otherwise be the only thing to retry.  On every instance, since
        # each worker process keeps its own copy of the hub id (see _native_app.py).
        api.looping_background_call(self.retry_unresolved_hub_id, 10_000, run_on_all_instances=True)
        # On one instance only: they would all deactivate the same accounts.
        self._deleted_pseudonyms_since = _NOT_LOADED
        self._deactivation_failures = {} # hashed hub pseudonym -> failed attempts, see deactivate_deleted
        api.looping_background_call(self.deactivate_deleted_accounts, self._config.deleted_accounts_poll_interval * 1000)

    def retry_unresolved_hub_id(self):
        if self._hub_id is None:
            self.trigger_get_constellation()

    async def deactivate_deleted_accounts(self):
        """Deactivate the accounts of users who deleted their PubHubs account.

        PHC keeps one list for all hubs, with a deleted account's hashed pseudonym at every hub,
        entered or not: PHC does not know which hub a pseudonym belongs to.  So most of the list
        is not ours, and we pick out our own by looking them up.  We ask for what is new since the
        last entry we handled, which we keep in the database so a restart does not have us go
        through the whole list again.
        """
        if self._deleted_pseudonyms_since is _NOT_LOADED:
            try:
                self._deleted_pseudonyms_since = await self._store.get_deleted_pseudonyms_since()
            except Exception as e:
                # e.g. HubClientApi has not created the table yet; we try again next round
                logger.warning(f"could not load where we were in PHC's deleted pseudonyms: {e}")
                return

        url = urljoin(self._config.phc_url, ".ph/hub/deleted-pseudonyms")
        req = {}
        if self._deleted_pseudonyms_since is not None:
            req['since'] = self._deleted_pseudonyms_since
        try:
            resp = await self._api.http_client.post_json_get_json(url, req)
        except Exception as e:
            # expected now and then (e.g. PHC restarting); we ask again next round
            logger.warn(f"could not retrieve deleted pseudonyms from {url}: {e}")
            return
        try:
            deleted = resp['Ok']['Success']['deleted']
        except (KeyError, TypeError):
            # e.g. PHC predating the endpoint
            logger.warn(f"could not retrieve deleted pseudonyms from {url}: PHC responded with {resp}")
            return

        since = await deactivate_deleted(self, deleted, self._deleted_pseudonyms_since)
        if since == self._deleted_pseudonyms_since:
            return
        self._deleted_pseudonyms_since = since
        try:
            await self._store.set_deleted_pseudonyms_since(since)
        except Exception as e:
            # We carry on from memory; saving is tried again after the next new entry.
            logger.warning(f"could not save where we are in PHC's deleted pseudonyms: {e}")

    @staticmethod
    def parse_config(config):
        if 'phc_url' not in config:
            logger.warn("pubhubs core module: phc_url not configured - not enabling multi-server setup endpoints")
            return None

        return Config(
                phc_url = config['phc_url'],
                hub_client_url = config.get('hub_client_url'),
                hub_info_update_interval = config.get('hub_info_update_interval', Config.hub_info_update_interval),
                deleted_accounts_poll_interval = config.get('deleted_accounts_poll_interval', Config.deleted_accounts_poll_interval))

    def trigger_get_constellation(self):
        now = time.time()
        # anyone can trick a hub into checking whether its constellation is up-to-date,
        # so we do not remove the old constellation until we've gotten the new one,
        # and we don't fire an unlimited amount of requests:
        if now - self._constellation_last_update_triggered < 3: # TODO: make configurable
            logger.info("not triggering update of constellation yet")
            return
        self._constellation_last_update_triggered = now
        logger.info("triggering update of constellation")
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
        if "Ok" not in resp:
            # PHC itself may still be starting up and answer .ph/user/welcome with
            # {"Err": "PleaseRetry"} (or another error); retriggered on demand
            logger.warn(f"could not retrieve constellation from {url}: PHC responded with {resp}")
            return
        ok_json = resp['Ok']
        if "constellation" not in ok_json:
            logger.warn(f"could not retrieve constellation from {url}: response lacks a constellation (keys: {list(ok_json.keys())})")
            return
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
        set_own_hub_id(self._hub_id)

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
        # See _hub_client_api_config.py
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


@dataclass(frozen=True)
class HhppPurpose:
    """Domain separation for one HHPP round trip.

    Entering and deactivating both hand the client a state/nonce pair and then verify an
    hhpp against it, but under different AADs, so a state minted for one flow cannot be
    replayed into the other.  `name` only feeds log messages.
    """
    name: str
    state_aad: bytes
    nonce_aad: bytes

# Enter keeps the AADs it has always used, so a rolling restart needs no coordination.
ENTER = HhppPurpose('enter', b"state", b"nonce")
DEACTIVATE = HhppPurpose('deactivate', b"deactivate_state", b"deactivate_nonce")


class PhStartEP(Resource):
    """A *-start endpoint: hands the client the state and nonce it needs to fetch an hhpp."""
    def __init__(self, core, purpose):
        self._core = core
        self._purpose = purpose

    def render_POST(self, request):
        return respond_with_json(
            request, 200, { 'Ok': mint_state_and_nonce(self._core, self._purpose) }, send_cors=True)


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


class HhppRejected(Exception):
    """Verification failed; `body` is the JSON the endpoint should return for it."""
    def __init__(self, body):
        super().__init__(body)
        self.body = body


def mint_state_and_nonce(core, purpose):
    """A fresh state/nonce pair, bound together by a shared random.

    The per-session mac_key travels to the transcryptor in the clear and comes back inside
    the hhpp as hub_id_mac; verify_hhpp recovers it from the state.
    """
    random = b64url_encode(nacl.utils.random(32))
    mac_key = b64url_encode(nacl.utils.random(32))

    state = b64url_encode(core._secret_box.encrypt(json.dumps({
        'random': random,
        'iat': time.time(),
        'mac_key': mac_key,
    }).encode('ascii'), purpose.state_aad))

    nonce = b64url_encode(core._secret_box.encrypt(json.dumps({
        'random': random
    }).encode('ascii'), purpose.nonce_aad))

    # Tell PHC to sign the HHPP with the bespoke composite scheme.  (We accept the standard
    # scheme too, but the backend only produces the bespoke one for now.)  Rollout order is
    # central servers first, then hubs, so PHC already understands this field.
    return {
        'state': state,
        'nonce': nonce,
        'hhpp_signature_scheme': BESPOKE_ALG,
        'hub_mac_key': mac_key,
    }


def parse_hhpp_body(request, purpose):
    """Pull (hhpp, state) out of a *-complete request body.  Raises HhppRejected."""
    try:
        r = json.load(request.content)
    except Exception as e:
        logger.warn(f"invalid json passed to {purpose.name}-complete endpoint: {e}")
        raise HhppRejected(bad_request())

    if not isinstance(r, dict) or "hhpp" not in r or "state" not in r:
        raise HhppRejected(bad_request())

    return r['hhpp'], r['state']


def verify_hhpp(core, hhpp, state_str, purpose):
    """Verify an hhpp against a state minted by mint_state_and_nonce for the same purpose.

    Returns the hashed hub pseudonym.  Raises HhppRejected(body) otherwise, where body is
    what the endpoint should return -- including the retry statuses, which are less errors
    than a request to go round again.
    """
    try:
        state = json.loads(core._secret_box.decrypt(b64url_decode(state_str), purpose.state_aad))
    except Exception as e:
        logger.warn(f"invalid state passed to {purpose.name}-complete endpoint: {e}")
        raise HhppRejected(bad_request())

    if not isinstance(state, dict) or "random" not in state or "iat" not in state or "mac_key" not in state:
        logger.error(f"missing fields in {purpose.name} state")
        raise HhppRejected(internal_error())

    state_random = state['random']
    state_iat = state['iat']

    # Only accept states not older than 10 seconds. (TODO: make configurable)
    if time.time() - state_iat > 10:
        logger.info(f"expired {purpose.name} state submitted")
        raise HhppRejected({ 'Ok': 'RetryFromStart' })

    # check_hhpp does the signature check plus the message-code/constellation/expiry routing and
    # the our/their-fault split; we only map each status to a response, refetching the
    # constellation (rate-limited) on the statuses where we might be the stale side.
    result = check_hhpp(hhpp, core._phc_verifying_key, core._constellation)
    match result.status:
        case HhppStatus.OUR_CONSTELLATION_STALE:
            logger.info(f"{purpose.name}-complete: our constellation is stale â older than the one mentioned "
                        "in the client's hhpp; triggering a constellation refresh and asking the client to retry")
            core.trigger_get_constellation()
            raise HhppRejected(please_retry())
        case HhppStatus.CONSTELLATIONS_DIVERGED:
            # can't tell who is behind: catch up in case it's us, and have the client start over
            logger.info(f"{purpose.name}-complete: our constellation and the one mentioned in the client's hhpp "
                        "diverge at the same created_at (cannot tell which is stale); triggering a "
                        "refresh and asking the client to start over")
            core.trigger_get_constellation()
            raise HhppRejected({ 'Ok': 'RetryFromStart' })
        case HhppStatus.THEIR_CONSTELLATION_STALE | HhppStatus.EXPIRED:
            # the client must obtain a fresh HHPP (theirs was signed by an old key, or aged out)
            raise HhppRejected({ 'Ok': 'RetryFromStart' })
        case HhppStatus.OTHERWISE_INVALID:
            raise HhppRejected(bad_request())
        case HhppStatus.MISMINTED:
            raise HhppRejected(internal_error())
        case HhppStatus.VERIFIED:
            claims = result.claims
        case _:
            raise AssertionError(f"unhandled hhpp status {result.status}")

    if not 'hub_nonce' in claims or 'pp_issued_at' not in claims or 'hashed_hub_pseudonym' not in claims:
        logger.error("missing fields in hhpp")
        raise HhppRejected(internal_error())

    pp_issued_at = claims['pp_issued_at']
    nonce_str = claims['hub_nonce']
    hhp = claims['hashed_hub_pseudonym']

    if not isinstance(pp_issued_at, int) or isinstance(pp_issued_at, bool):
        # pp_issued_at is a NumericDate (a u64); a non-integer means PHC misminted the hhpp
        logger.error("misminted hhpp: non-integer pp_issued_at")
        raise HhppRejected(internal_error())

    if time.time() - pp_issued_at > 10: # TODO: make configurable
        logger.info("hhpp from pp that was issued too long ago")
        raise HhppRejected({ 'Ok': 'RetryFromStart' })

    try:
        nonce = json.loads(core._secret_box.decrypt(b64url_decode(nonce_str), purpose.nonce_aad))
    except Exception as e:
        logger.warn(f"invalid nonce passed to {purpose.name}-complete endpoint: {e}")
        raise HhppRejected(bad_request())

    if not isinstance(nonce, dict) or "random" not in nonce:
        logger.error(f"missing fields in {purpose.name} nonce")
        raise HhppRejected(internal_error())

    if nonce['random'] != state_random:
        logger.warn(f"mismatch between {purpose.name} nonce and state")
        raise HhppRejected(bad_request())

    # Verify the transcryptor pseudonymised for *this* hub: recompute the hub-id mac over our own id
    # with the per-session key from our state, and reject a mismatch (a client that requested a
    # different hub's factor).  Fail closed.
    if core._hub_id is None:
        # not resolved yet (e.g. PHC hadn't listed us at startup); refetch and have the client retry
        logger.info(f"{purpose.name}-complete: our hub id is not resolved yet (PHC may not list this hub, or "
                    "its constellation could not be retrieved); triggering a refresh and asking the client to retry")
        core.trigger_get_constellation()
        raise HhppRejected(please_retry())

    if 'hub_id_mac' not in claims:
        logger.warn("hhpp lacks the hub-id mac (stale or non-compliant client)")
        raise HhppRejected(bad_request())

    if not verify_hub_id_mac(core._hub_id, state['mac_key'], claims['hub_id_mac']):
        logger.warn("hub-id mac mismatch: transcryptor pseudonymised for a different hub")
        raise HhppRejected(bad_request())

    return hhp


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
            hhpp, state_str = parse_hhpp_body(request, ENTER)
            hhp = verify_hhpp(self._core, hhpp, state_str, ENTER)
        except HhppRejected as e:
            return e.body

        logger.info(f"enter user with hashed hub pseudonym {hhp}")

        # A deactivated account is unlinked from its pseudonym by deactivate-complete, so a
        # returning user misses here and is registered afresh.  Deactivation is final: the
        # old account stays erased, and nothing of it carries over to the new one.
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


async def deactivate_for_good(core, mxid, hhp, requester):
    """Erase `mxid` and unlink it from `hhp`, the hashed hub pseudonym it was registered under.

    Raises when erasing fails, leaving the account as it was.  Past that point the account is
    unreachable, so the clean-up after it only logs its failures.
    """
    deactivate_handler = core._api._hs.get_deactivate_account_handler()
    await deactivate_handler.deactivate_account(
        mxid,
        erase_data=True,
        requester=requester,
        by_admin=False,
    )

    # Unlink the pseudonym from the account we just erased.  Entering this hub again
    # then misses the external-id lookup and registers a fresh matrix user, instead of
    # resurrecting this one -- `activate_account` would clear the erasure and make all
    # of its old messages readable again, which is not what deactivating asked for.
    #
    # A failure here leaves a stale mapping and some rows nobody can match to a person
    # anymore, so we log it rather than have the deactivation retried.
    try:
        await core._api._store.remove_user_external_id("pubhubs", hhp, mxid)
    except Exception as e:
        logger.error(f"failed to unlink pseudonym from deactivated {mxid}: {e}")

    try:
        await core._store.delete_user_rows(mxid)
    except Exception as e:
        logger.error(f"failed to delete hub data of deactivated {mxid}: {e}")


async def deactivate_deleted(core, deleted, since):
    """Deactivate the accounts behind `deleted`, PHC's list of deleted pseudonyms (oldest first).

    Returns the `since` to ask PHC for next: the `deleted_at` of the last entry handled.  Stops
    at an account that fails to deactivate, so it is asked for again next round -- but only
    `MAX_DEACTIVATION_ATTEMPTS` times.  After that we give up on it and move on, because an
    account that never deactivates would otherwise hold up every deletion after it, until PHC
    prunes them from its list and they are lost.
    """
    for entry in deleted:
        hhp = entry['hashed_hub_pseudonym']
        mxid = await core._api._store.get_user_by_external_id("pubhubs", hhp)
        if mxid is not None:
            logger.info(f"deactivating {mxid}, whose PubHubs account was deleted")
            try:
                # as if the user asked for it, which they did
                await deactivate_for_good(core, mxid, hhp, create_requester(mxid))
            except Exception as e:
                attempts = core._deactivation_failures.get(hhp, 0) + 1
                if attempts < MAX_DEACTIVATION_ATTEMPTS:
                    core._deactivation_failures[hhp] = attempts
                    logger.error(f"failed to deactivate {mxid}, whose PubHubs account was deleted "
                                 f"(attempt {attempts} of {MAX_DEACTIVATION_ATTEMPTS}): {e}")
                    return since
                logger.error(f"giving up on deactivating {mxid}, whose PubHubs account was deleted, "
                             f"after {attempts} attempts; it needs to be deactivated by hand: {e}")
            core._deactivation_failures.pop(hhp, None)
        since = entry['deleted_at']
    return since


class PhDeactivateCompleteEP(Resource):
    """Endpoint to complete account deactivation. Verifies HHPP matches the authenticated user."""
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
        logger.error(f"unhandled error in deactivate-complete: {failure.getTraceback()}")
        self._finish_request(request, internal_error())

    async def _render_POST_async(self, request):
        # get_user_by_req parses and validates the bearer token itself, and raises if it is
        # missing or bad.
        try:
            requester = await self._core._api.get_user_by_req(request)
            mxid = requester.user.to_string()
        except Exception as e:
            logger.warn(f"deactivate-complete: invalid access token: {e}")
            return { 'Err': 'Unauthorized' }

        try:
            hhpp, state_str = parse_hhpp_body(request, DEACTIVATE)
            hhp = verify_hhpp(self._core, hhpp, state_str, DEACTIVATE)
        except HhppRejected as e:
            return e.body

        # The hhpp proves control of *some* pseudonym on this hub; check it is this user's,
        # so a valid hhpp cannot be used to deactivate somebody else's account.
        user_hhp = await self._core._api._store.get_user_by_external_id("pubhubs", hhp)

        if user_hhp != mxid:
            logger.warn(f"deactivate-complete: HHPP pseudonym does not match authenticated user "
                        f"(hhp maps to {user_hhp}, but request is from {mxid})")
            return { 'Err': 'PseudonymMismatch' }

        logger.info(f"deactivating account for {mxid}")
        try:
            await deactivate_for_good(self._core, mxid, hhp, requester)
        except Exception as e:
            logger.error(f"failed to deactivate account for {mxid}: {e}")
            return internal_error()

        logger.info(f"successfully deactivated account for {mxid}")
        return { 'Ok': 'Deactivated' }
