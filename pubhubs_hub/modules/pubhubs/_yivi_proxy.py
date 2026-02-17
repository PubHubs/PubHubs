import json
import re
import logging
from json.decoder import JSONDecodeError

import twisted
from synapse.http.server import DirectServeJsonResource, respond_with_json
from synapse.http.site import SynapseRequest
from synapse.module_api import ModuleApi
from twisted.internet import reactor
from twisted.internet.defer import Deferred
from twisted.internet.error import ConnectionDone
from twisted.internet.protocol import Protocol, connectionDone
from twisted.python import failure
from twisted.web._newclient import ResponseDone
from twisted.web.client import Agent

from twisted.web.iweb import IResponse, UNKNOWN_LENGTH

from ._cors import set_allow_origin_header

logger = logging.getLogger("synapse.contrib." + __name__)


class ProxyServlet(DirectServeJsonResource):
    """Servlet to proxy the Yivi requests and responses, made to join rooms with certain attribute requirements,
    so required configuration is minimized and the Yivi server to disclose can run in the same image as the Synapse server.
    """

    def __init__(self, config: dict, module_api: ModuleApi):
        super().__init__()
        self._config = config
        self._module_api = module_api
        # Always get entire path
        self.isLeaf = True

    async def _async_render(self, request: SynapseRequest):
        set_allow_origin_header(request, self._config.allowed_origins)
        content = request.content.read()

        path = request.path.decode()

        # Define allowed path patterns
        ALLOWED_PATTERNS = [
            r'^/_synapse/client/yiviproxy/irma/session/[a-zA-Z0-9_-]{20}/frontend/statusevents$',
            r'^/_synapse/client/yiviproxy/irma/session/[a-zA-Z0-9_-]{20}/frontend/status$',
            r'^/_synapse/client/yiviproxy/irma/session/[a-zA-Z0-9_-]{20}/',
        ]
        
        # Check if the request path matches any allowed pattern
        if not any(re.match(pattern, path) for pattern in ALLOWED_PATTERNS):
            logger.warning(f"Rejected proxy request to disallowed path: {path}")
            respond_with_json(request, 403, {"error": "Path not allowed"})
            return

        about_statusevents = path.endswith("statusevents")

        if about_statusevents:
            await self.handle_status_events(request)
        else:
            resp: IResponse = await self._module_api.http_client.request(request.method.decode(),
                                                        f"{self._config.yivi_url_proxy}/{'/'.join(path.split('/')[4:])}",
                                                        content, request.requestHeaders)


            resp_content = await resp.content()

            try:
                resp_json = json.loads(resp_content)
                respond_with_json(request, resp.code, resp_json)
            except JSONDecodeError:
                logger.error(f"Got a non-json response from Yivi: '{resp_content}'")
                respond_with_json(request, 500, {})

    async def handle_status_events(self, request):
        agent = Agent(reactor)
        url = bytes(
            f"{self._config.yivi_url_proxy}/{'/'.join(request.path.decode().split('/')[4:])}",
            "utf-8")
        d = agent.request(request.method, url, request.requestHeaders)

        def cb_response(response: twisted.web._newclient.Response):
            request.responseHeaders = response.headers

            request.setResponseCode(response.code)

            proto = ProxyStatusEvents(request)
            if response.length is not UNKNOWN_LENGTH:
                print("The response body will consist of", response.length, "bytes.")
            else:
                print("The response body length is unknown.")
            response.deliverBody(proto)
            return proto.onConnLost

        d.addCallback(cb_response)
        d.addErrback(logging.error)


class ProxyStatusEvents(Protocol):
    def __init__(self, request: SynapseRequest):
        self.request = request

    def connectionMade(self):
        self.onConnLost = Deferred()

    def dataReceived(self, data):
        self.request.write(data)
        d = data[len("data: "):].decode("utf-8")
        try:
            maybeJson = json.loads(d)
            status = maybeJson.get("status")
            if status in ["CANCELLED", "DONE", "TIMEOUT"]:
                self.connectionLost()
        except JSONDecodeError:
            pass

    def connectionLost(self, reason: failure.Failure = connectionDone):
        if not reason.check(ResponseDone) and not reason.check(ConnectionDone):
            reason.printTraceback()
        self.onConnLost.callback(None)
