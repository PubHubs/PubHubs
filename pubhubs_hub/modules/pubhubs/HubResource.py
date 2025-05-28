from synapse.module_api import ModuleApi
from synapse.http.site import SynapseRequest
from synapse.http.server import DirectServeJsonResource, respond_with_json
import logging

from .HubClientApiConfig import HubClientApiConfig
from ._store import HubStore
from .HubMediaResource import HubMediaResource
from .HubJSONResource import HubJSONResource

logger = logging.getLogger("synapse.contrib." + __name__)

class HubResource(DirectServeJsonResource):
	"""
	Synapse lets us add api endpoints by adding implementations of Twisted's IResource interface.
	We use synapse.http.server.DirectServeJsonResource here, which is an undocumented class from Synapse.
	This is not ideal, but we didn't get async responses to work without it.
	"""

	_module_api: ModuleApi
	_module_config: HubClientApiConfig

	def __init__(self, module_api: ModuleApi, module_config: HubClientApiConfig, store: HubStore):
		super().__init__()

		self._module_api = module_api
		self._module_config = module_config
		self._store = store

		self.putChild(b'icon', HubMediaResource(module_api, module_config, media_type="icon", is_default=False))
		self.putChild(b'default-icon', HubMediaResource(module_api, module_config, media_type="icon", is_default=True))
		self.putChild(b'banner', HubMediaResource(module_api, module_config, media_type="banner", is_default=False))
		self.putChild(b'default-banner', HubMediaResource(module_api, module_config, media_type="banner", is_default=True))
		self.putChild(b'settings', HubJSONResource(module_api, module_config, store, is_default=False))
		self.putChild(b'default-settings', HubJSONResource(module_api, module_config, store, is_default=True))
		self.putChild(b'users', HubUserResource(module_api, module_config , store ,only_admin_data=True))

class HubUserResource(DirectServeJsonResource):
    _module_api: ModuleApi
    _module_config: HubClientApiConfig
    _hub_store: HubStore
    
    def __init__(self, module_api: ModuleApi, module_config: HubClientApiConfig, hub_Store: HubStore, only_admin_data):
        super().__init__()
        self._module_api = module_api
        self._module_config = module_config
        self._hub_store = hub_Store
        self._only_admin_data = only_admin_data
        
    async def _async_render_GET(self, request: SynapseRequest) -> bytes:
        if self._only_admin_data:
            admins_tuples = await self._hub_store.get_hub_admins()
            admin_ids = [admin_tuple[0] for admin_tuple in admins_tuples]
            request.setHeader(b"Access-Control-Allow-Origin", self._module_config.hub_client_url.encode())
            respond_with_json(request, 200, admin_ids) 