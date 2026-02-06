from synapse.module_api import ModuleApi
from synapse.http.server import DirectServeJsonResource
import logging

from .HubClientApiConfig import HubClientApiConfig
from ._store import HubStore
from ._HubMediaResource import HubMediaResource
from ._HubSettingsResource import HubSettingsResource
from ._HubDataResource import HubDataResource

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
		self.putChild(b'settings', HubSettingsResource(module_api, module_config, store, is_default=False))
		self.putChild(b'default-settings', HubSettingsResource(module_api, module_config, store, is_default=True))
		self.putChild(b'data', HubDataResource(module_api, module_config , store ))
 
			
		