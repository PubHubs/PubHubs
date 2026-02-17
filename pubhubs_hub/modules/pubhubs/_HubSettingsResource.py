from synapse.http.site import SynapseRequest
from synapse.module_api import ModuleApi
from synapse.http.server import DirectServeJsonResource, respond_with_json

from .HubClientApiConfig import HubClientApiConfig
from ._validation import user_validator
from ._cors import set_allow_origin_header
from ._store import HubStore

import logging
import json
import os

logger = logging.getLogger("synapse.contrib." + __name__)

class HubSettingsResource(DirectServeJsonResource):
	"""
	HubSettingsResource provides a resource to retrieve and update the hub's JSON settings file.

	Methods:
		async _async_render_GET(request: SynapseRequest) -> bytes:
			- Handles GET requests to retrieve the hub's JSON settings
			- This Get request a public endpoint and therefore allows all origins with a wildcard '*'
		async _async_render_POST(request: SynapseRequest) -> bytes:
			- Handles POST requests to update the hub's JSON settings.
			- Only allows updates by hub administrators.
	  Example usage:
	     GET <hub_address>/_synapse/client/hub/settings
	"""
	_module_api: ModuleApi
	_config: HubClientApiConfig
	_store: HubStore
	
	def __init__(self, module_api: ModuleApi, config: HubClientApiConfig, store: HubStore):
		super().__init__()
		
		self._module_api = module_api
		self._config = config
		self._store = store
	
	async def _async_render_GET(self, request: SynapseRequest) -> bytes:
		path = self._config.hub_description_path
		
		if not os.path.exists(path):
			path = self._config.default_hub_description_path
			
		with open(path, "r") as fd:
			hub_settings_json = json.load(fd)

		request.setHeader(b"Access-Control-Allow-Origin", "*")
		request.setHeader(b"Content-Type", b"application/json")
		respond_with_json(request, 200, hub_settings_json)
    
	@user_validator(require_admin=True)
	async def _async_render_POST(self, request: SynapseRequest, _) -> bytes:
			
		set_allow_origin_header(request, self._config.allowed_origins)
	
		content_bytes = request.content.read()
		
		description_data = json.loads(content_bytes)
		
		formatted_json = json.dumps(description_data, indent=2)
		
		with open(self._config.hub_description_path, "w") as fd:
			fd.write(formatted_json)
		
		respond_with_json(request, 200, {"message": "Hub JSON data updated."})
	
	
