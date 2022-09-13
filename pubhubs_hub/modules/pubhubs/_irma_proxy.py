import json
import logging
from json.decoder import JSONDecodeError

from synapse.http.server import DirectServeJsonResource, respond_with_json
from synapse.http.site import SynapseRequest
from synapse.module_api import ModuleApi

from twisted.web.iweb import IResponse

logger = logging.getLogger("synapse.contrib." + __name__)


class ProxyServlet(DirectServeJsonResource):
    """Servlet to proxy the IRMA requests and responses, made to join rooms with certain attribute requirements,
    so required configuration is minimized and the IRMA server to disclose can run in the same image as the Synapse server.
    """

    def __init__(self, config: dict, api: ModuleApi):
        super().__init__()
        self.config = config
        self.module_api = api
        # Always get entire path
        self.isLeaf = True

    async def _async_render(self, request: SynapseRequest):
        http_client = self.module_api.http_client
        content = request.content.read()

        resp: IResponse = await http_client.request(request.method.decode(),
                                                    f"{self.config.get('irma_client_url', 'http://localhost:8088')}/{'/'.join(request.path.decode().split('/')[4:])}",
                                                    content, request.requestHeaders)

        request.setHeader(
            b"Access-Control-Allow-Origin",
            f"{self.module_api.public_baseurl}".encode())

        resp_content = await resp.content()
        try:
            resp_json = json.loads(resp_content)
            respond_with_json(request, resp.code, resp_json)
        except JSONDecodeError:
            logger.error(f"Got a non-json respons from IRMA: '{resp_content}'")
            respond_with_json(request, 500, {})
