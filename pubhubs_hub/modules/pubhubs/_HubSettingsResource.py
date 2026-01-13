from synapse.http.site import SynapseRequest
from synapse.module_api import ModuleApi
from synapse.http.server import DirectServeJsonResource, respond_with_json
from .HubClientApiConfig import HubClientApiConfig
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
		async _async_render_POST(request: SynapseRequest) -> bytes:
			- Handles POST requests to update the hub's JSON settings.
			- Only allows updates by hub administrators.
		async _user_is_admin(request) -> bool:
			- Checks if the user making the request is a hub administrator.
	  Example usage:
	     GET <hub_address>/_synapse/client/hub/settings
	"""
	_module_api: ModuleApi
	_module_config: HubClientApiConfig
	_store: any
	
	def __init__(self, module_api: ModuleApi, module_config: HubClientApiConfig, store: HubStore):
		super().__init__()
		
		self._module_api = module_api
		self._module_config = module_config
		self._store = store
	
	async def _async_render_GET(self, request: SynapseRequest) -> bytes:
		path = self._module_config.hub_description_path
		
		if not os.path.exists(path):
			path = self._module_config.default_hub_description_path
			
		with open(path, "r") as fd:
			hub_settings_json = json.load(fd)

		request.setHeader(b"Access-Control-Allow-Origin", "*")
		request.setHeader(b"Content-Type", b"application/json")
		respond_with_json(request, 200, hub_settings_json)
    
	async def _async_render_POST(self, request: SynapseRequest) -> bytes:
		if not await self._user_is_admin(request):
			respond_with_json(request, 403, {"message": "Only Hub admins can update the Hub JSON data."})
			return
			
			
		try:
			request.setHeader(b"Access-Control-Allow-Origin", "*")

			content_bytes = request.content.read()
			
			description_data = json.loads(content_bytes)
			
			formatted_json = json.dumps(description_data, indent=2)
			
			with open(self._module_config.hub_description_path, "w") as fd:
				fd.write(formatted_json)
			
			
			respond_with_json(request, 200, {"message": "Hub JSON data updated."})
		except json.JSONDecodeError:
			respond_with_json(request, 400, {"message": "Invalid JSON format."})
		except Exception as e:
			logger.error(f"Error updating hub settings JSON: {str(e)}")
			respond_with_json(request, 500, {"message": f"Failed to update Hub settings JSON: {str(e)}"})
	
	async def _user_is_admin(self, request) -> bool:
		user = await self._module_api.get_user_by_req(request)
		if not await self._module_api.is_user_admin(user.user.to_string()):
			logger.info(f"User {user.user.to_string()} is not an admin.")
			return False
			
		return True
	
