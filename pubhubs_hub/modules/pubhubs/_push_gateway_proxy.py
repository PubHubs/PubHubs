import json
import logging
from json.decoder import JSONDecodeError

from twisted.web.http_headers import Headers

from synapse.http.server import DirectServeJsonResource, respond_with_json
from synapse.http.site import SynapseRequest
from synapse.module_api import ModuleApi

logger = logging.getLogger("synapse.contrib." + __name__)

# Sygnal's own loopback address, as bundled with this image (see config/local/sygnal.local.yaml's
# `http:` section) and started as a sibling process by boot/start_hub.py. Internal only - never
# published outside this container, and never reached any other way than through this proxy.
_SYGNAL_URL = "http://localhost:5000/_matrix/push/v1/notify"


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
        content = request.content.read()

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
