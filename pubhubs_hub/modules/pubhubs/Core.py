import logging
import json
import subprocess
from pathlib import Path
from synapse.module_api import ModuleApi
from prometheus_client import Gauge
from twisted.web.resource import Resource

logger = logging.getLogger("synapse.contrib." + __name__)

# Module that adds some of the core pubhubs functionality:
#   - version number metrics
#   - the '_synapse/client/.ph/' endpoints 

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

        # [Endpoint] 
        api.register_web_resource('/_synapse/client/.ph/info', PhInfoEP(hub_version=version_string))


    @staticmethod
    def parse_config(config):
        return None

def get_version_string():
    try:
        return Path('hub_version').read_text().strip()
    except FileNotFoundError as e:
        logger.warn(f"Could not obtain hub version: {e}")
        return "n/a runtime"

class PhInfoEP(Resource):
    def __init__(self, hub_version):
        self._hub_version = hub_version

    def render_GET(self, request):
        request.responseHeaders.addRawHeader(b"content-type", b"application/json")
        return json.dumps({
                'hub_version': self._hub_version
            }).encode('ascii')

