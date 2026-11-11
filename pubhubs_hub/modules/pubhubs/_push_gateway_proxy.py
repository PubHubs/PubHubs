import json
import logging
from json.decoder import JSONDecodeError
from urllib.parse import urljoin

from synapse.http.server import DirectServeJsonResource, respond_with_json
from synapse.http.site import SynapseRequest
from synapse.module_api import ModuleApi

from ._hub_signing import TRANSCRYPTOR_PUSH_REQ

logger = logging.getLogger("synapse.contrib." + __name__)

# The transcryptor's url, from the constellation; set by Core.get_constellation.
_transcryptor_url = None


def set_transcryptor_url(url):
    global _transcryptor_url
    _transcryptor_url = url


# The hub's tickets (_hub_signing.HubTickets): the transcryptor only relays pushes from hubs.
_hub_tickets = None


def set_hub_tickets(tickets):
    global _hub_tickets
    _hub_tickets = tickets


def push_request(body: dict):
    """Turns a Push Gateway API notify body from Synapse into the pushes for the transcryptor's
    `.ph/push` endpoint, and the pushkeys they belong to.

    Only the blob the app put in the pusher's data goes out (the device's push token, encrypted for
    PHC): no room, event, sender, counts, priority or pushkey. Pushers without a blob are from older
    app versions; they're returned separately so Synapse deletes them."""
    notification = body.get("notification", {})
    pushes, pushkeys, without_blob = [], [], []
    for device in notification.get("devices", []):
        blob = (device.get("data") or {}).get("blob")
        if isinstance(blob, str) and blob:
            pushes.append({"blob": blob})
            pushkeys.append(device.get("pushkey"))
        else:
            without_blob.append(device.get("pushkey"))
    return pushes, pushkeys, without_blob


def gateway_response(transcryptor_resp: dict, pushkeys: list, without_blob: list):
    """The (status, body) to answer Synapse with, given the transcryptor's answer. Synapse deletes
    the pushers of `rejected` pushkeys, and retries later when the status isn't 200."""
    ok = transcryptor_resp.get("Ok")
    if ok == "RetryWithNewTicket":
        if _hub_tickets is not None:
            _hub_tickets.forget_ticket()
        return 502, {"error": "push relay wants a new ticket"}
    if ok == "TooManyPushes":
        return 502, {"error": "push relay: too many pushes from this hub, try again later"}
    ok = ok.get("Success") if isinstance(ok, dict) else None
    if not isinstance(ok, dict):
        return 502, {"error": f"push relay answered {transcryptor_resp}"}
    if ok.get("failed"):
        return 502, {"error": "push could not be delivered now"}
    return 200, {"rejected": without_blob + [pushkeys[i] for i in ok.get("rejected", []) if 0 <= i < len(pushkeys)]}


class PushGatewayProxyServlet(DirectServeJsonResource):
    """The hub's Matrix push gateway, at `_matrix/push/v1/notify` on the hub's own address (see
    global-client/src/logic/nativePush.ts's pushGatewayUrl()). Registered by HubClientApi.py.

    Relays pushes to PubHubs' push relay: the transcryptor, which passes them on to PHC without
    saying which hub they come from, and PHC, which can read the blobs and holds the Apple and Google
    credentials. So the hub never sees a device's push token, and needs no push configuration. See
    pubhubs/src/servers/phc/push.rs.
    """

    def __init__(self, module_api: ModuleApi):
        super().__init__()
        self._module_api = module_api
        self.isLeaf = True

    async def _async_render_POST(self, request: SynapseRequest):
        try:
            pushes, pushkeys, without_blob = push_request(json.loads(request.content.read()))
        except (JSONDecodeError, AttributeError, TypeError) as e:
            respond_with_json(request, 400, {"error": f"malformed notification: {e}"})
            return

        if not pushes:
            respond_with_json(request, 200, {"rejected": without_blob})
            return

        if _transcryptor_url is None:
            # Core hasn't got the constellation from PHC yet: let Synapse retry with backoff.
            logger.warning("push gateway: transcryptor url not known yet, not forwarding push")
            respond_with_json(request, 502, {"error": "push relay not known yet"})
            return

        signed = await _hub_tickets.ticket_signed({"pushes": pushes}, TRANSCRYPTOR_PUSH_REQ) if _hub_tickets else None
        if signed is None:
            # No ticket from PHC yet (e.g. PHC can't reach our .ph/info): let Synapse retry.
            logger.warning("push gateway: no ticket from PHC yet, not forwarding push")
            respond_with_json(request, 502, {"error": "no ticket for the push relay yet"})
            return

        url = urljoin(_transcryptor_url, ".ph/push")
        try:
            resp = await self._module_api.http_client.post_json_get_json(url, signed)
        except Exception as e:
            logger.warning(f"push gateway: could not reach the push relay at {url}: {e}")
            respond_with_json(request, 502, {"error": "push relay unavailable"})
            return

        status, body = gateway_response(resp, pushkeys, without_blob)
        if status != 200:
            logger.warning(f"push gateway: {body['error']}")
        respond_with_json(request, status, body)
