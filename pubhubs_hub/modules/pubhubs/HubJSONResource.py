from synapse.http.site import SynapseRequest
from synapse.module_api import ModuleApi
from synapse.http.server import DirectServeJsonResource, respond_with_json
from .HubClientApiConfig import HubClientApiConfig
from ._store import HubStore
import logging
import json
import os

logger = logging.getLogger("synapse.contrib." + __name__)

class HubJSONResource(DirectServeJsonResource):
	_module_api: ModuleApi
	_module_config: HubClientApiConfig
	_store: any
	_is_default: bool
	
	def __init__(self, module_api: ModuleApi, module_config: HubClientApiConfig, store, is_default: bool = False):
		super().__init__()
		
		self._module_api = module_api
		self._module_config = module_config
		self._store = store
		self._is_default = is_default
	
	async def _async_render_GET(self, request: SynapseRequest) -> bytes:
		path = self._get_json_path()
		
		if not os.path.exists(path):
			path = self._module_config.default_hub_description_path
			
		with open(path, 'r') as fd:
			hub_settings_json = json.load(fd)

		origin = request.getHeader(b"Origin")
		if origin in [self._module_config.hub_client_url.encode(), self._module_config.global_client_url.encode()]:
			if origin == self._module_config.hub_client_url.encode():
				# Use get_user_by_req to validate the access token
				try:
					await self._module_api.get_user_by_req(request)
				except Exception as e:
					respond_with_json(request, 400, {"error": {e}})
					return
				timestamps = await self._store.all_rooms_latest_timestamp()
				hub_settings_json['timestamps'] = timestamps

			request.setHeader(b"Access-Control-Allow-Origin", origin)
			request.setHeader(b"Content-Type", b"application/json")
			respond_with_json(request, 200, hub_settings_json)
		else:
			respond_with_json(request, 403, {"message": "Origin not allowed."})
    
	async def _async_render_POST(self, request: SynapseRequest) -> bytes:
		if not await self._user_is_admin(request):
			respond_with_json(request, 403, {"message": "Only Hub admins can update the Hub JSON data."})
			return
			
			
		try:
			content_bytes = request.content.read()
			
			description_data = json.loads(content_bytes)
			
			formatted_json = json.dumps(description_data, indent=2)
			
			with open(self._get_json_path(), 'w') as fd:
				fd.write(formatted_json)
			
			request.setHeader(b"Access-Control-Allow-Origin", self._module_config.hub_client_url.encode())
			respond_with_json(request, 200, {"message": "Hub JSON data updated."})
		except json.JSONDecodeError:
			respond_with_json(request, 400, {"message": "Invalid JSON format."})
		except Exception as e:
			logger.error(f"Error updating description: {str(e)}")
			respond_with_json(request, 500, {"message": f"Failed to update Hub JSON: {str(e)}"})
	
	async def _async_render_DELETE(self, request: SynapseRequest) -> bytes:
		if not await self._user_is_admin(request):
			respond_with_json(request, 403, {"message": "Only Hub admins can delete the Hub JSON data."})
			return
			
		description_path = self._get_json_path()
		if os.path.exists(description_path):
			os.remove(description_path)
			
		request.setHeader(b"Access-Control-Allow-Origin", self._module_config.hub_client_url.encode())
		respond_with_json(request, 200, {"message": "Hub JSON data deleted."})
	
	async def _user_is_admin(self, request) -> bool:
		user = await self._module_api.get_user_by_req(request)
		if not await self._module_api.is_user_admin(user.user.to_string()):
			logger.info(f"User {user.user.to_string()} is not an admin.")
			return False
			
		return True
	
	def _get_json_path(self) -> str:
		if self._is_default:
			return self._module_config.default_hub_description_path
		else:
			return self._module_config.hub_description_path
