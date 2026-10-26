import json
import logging
from json.decoder import JSONDecodeError

from twisted.web.http_headers import Headers

from synapse.http.server import DirectServeJsonResource, respond_with_json
from synapse.http.site import SynapseRequest
from synapse.module_api import ModuleApi

from ._native_app import own_hub_id

logger = logging.getLogger("synapse.contrib." + __name__)

# Sygnal's own loopback address, as bundled with this image (see config/local/sygnal.local.yaml's
# `http:` section) and started as a sibling process by boot/start_hub.py. Internal only - never
# published outside this container, and never reached any other way than through this proxy.
_SYGNAL_URL = "http://localhost:5000/_matrix/push/v1/notify"

# Matrix pusher `app_id`s that Sygnal delivers through APNs - see
# global-client/src/logic/nativePush.ts's APP_ID_BY_TRANSPORT and config/local/sygnal.local.yaml.
_APNS_APP_IDS = frozenset({"nl.pubhubs.client.ios"})

# Generic iOS alert, shown by iOS itself from strings bundled in the app
# (ios/App/App/{en,nl}.lproj/Localizable.strings) - the same text, from the same string names, that
# Android's LocalNotifier shows (android/app/src/main/res/values*/strings.xml). Only keys go out, so
# no message content, and no language choice, is ever made here.
_APNS_ALERT = {
    "alert": {"title-loc-key": "push_notification_title", "loc-key": "push_notification_body"},
    "sound": "default",
}


def sanitize_notification(body: dict, hub_id: str) -> dict:
    """Rewrites a Push Gateway API notify body from Synapse so that every platform gets the same
    content-free push: just this hub's `hub_id`, which the app on every platform reads and nothing
    else (ios/App/App/NativePushPlugin.swift, android/.../push/FcmService.java and
    UnifiedPushService.java).

    Everything else Synapse sends (room_id, counts, and with another format also sender and
    content) is dropped here rather than trusted to the pusher's `format: event_id_only`, which
    a client sets and could get wrong. Only `event_id` is kept: Sygnal's APNs pushkin needs it to
    take its `event_id_only` code path (without one, it builds an alert from the message content
    instead). It is opaque outside this hub.

    APNs devices also get the generic alert above, and the notification is forced to high
    priority: Synapse marks plain room messages "low", which Sygnal turns into APNs priority 5, and
    iOS may hold those back for a long time - unlike Android, where the app shows its own
    notification and priority stays whatever Synapse decided.
    """
    notification = body.get("notification", {})
    devices = []
    for device in notification.get("devices", []):
        default_payload = {"hub_id": hub_id}
        if device.get("app_id") in _APNS_APP_IDS:
            default_payload["aps"] = _APNS_ALERT
        devices.append({**device, "data": {**device.get("data", {}), "default_payload": default_payload}})

    sanitized = {"devices": devices}
    if "event_id" in notification:
        sanitized["event_id"] = notification["event_id"]
    # Synapse sends one device per request (one per pusher), so "any" is "the" device here.
    if any(device.get("app_id") in _APNS_APP_IDS for device in devices):
        sanitized["prio"] = "high"
    elif "prio" in notification:
        sanitized["prio"] = notification["prio"]
    return {"notification": sanitized}


class PushGatewayProxyServlet(DirectServeJsonResource):
    """Proxies the Matrix Push Gateway API's notify endpoint to a Sygnal instance running as a
    sibling process in this same container, so the hub's own public URL can serve
    `_matrix/push/v1/notify` itself - exactly what a hub's own domain does in production (see
    global-client/src/logic/nativePush.ts's pushGatewayUrl() and its "reverse-proxied under the
    hub's own domain" comment). Registered at that exact path by HubClientApi.py.

    Most hubs never configure Sygnal (see config/local/sygnal.local.yaml): boot/start_hub.py then
    never starts it, and this proxy just fails closed with a 502 - the client-side pusher
    registration already tolerates that silently (see nativePush.ts's setPusher() try/catch), so
    hubs that don't opt into local push testing are unaffected.
    """

    def __init__(self, module_api: ModuleApi):
        super().__init__()
        self._module_api = module_api
        # Always get the entire path, though there is only ever the one path this is registered at.
        self.isLeaf = True

    async def _async_render_POST(self, request: SynapseRequest):
        hub_id = own_hub_id()
        if hub_id is None:
            # Core hasn't resolved this hub's id from PHC yet. A push without one is useless to the
            # app, so fail and let Synapse retry it with backoff.
            logger.warning("push gateway proxy: hub id not known yet, not forwarding push")
            respond_with_json(request, 502, {"error": "hub id not known yet"})
            return

        try:
            body = json.loads(request.content.read())
            content = json.dumps(sanitize_notification(body, hub_id)).encode()
        except (JSONDecodeError, AttributeError, TypeError) as e:
            respond_with_json(request, 400, {"error": f"malformed notification: {e}"})
            return

        try:
            # Only Content-Type: forwarding the incoming headers wholesale duplicates Host and
            # Content-Length (the HTTP client sets its own), which Sygnal's Twisted server answers
            # with a bare 400 before Sygnal itself ever sees the request.
            resp = await self._module_api.http_client.request("POST", _SYGNAL_URL, content,
                                                              Headers({b"Content-Type": [b"application/json"]}))
        except Exception as e:
            logger.warning(f"push gateway proxy: Sygnal not reachable at {_SYGNAL_URL}: {e}")
            respond_with_json(request, 502, {"error": "push gateway unavailable"})
            return

        resp_content = await resp.content()
        try:
            respond_with_json(request, resp.code, json.loads(resp_content))
        except JSONDecodeError:
            logger.error(f"push gateway proxy: got a non-JSON response from Sygnal: {resp_content!r}")
            respond_with_json(request, 502, {})
