from synapse.http.site import SynapseRequest
from synapse.module_api import ModuleApi
from synapse.http.server import DirectServeJsonResource, respond_with_json
import logging
import json
import os

from .HubClientApiConfig import HubClientApiConfig
from ._store import HubStore

logger = logging.getLogger("synapse.contrib." + __name__)

ALLOWED_HUB_MEDIA_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml"]

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

class HubMediaResource(DirectServeJsonResource):
	_module_api: ModuleApi
	_module_config: HubClientApiConfig
	_store: HubStore
	_darkmode: bool
	_is_default: bool
	_media_type: str  # Either "icon" or "banner"

	def __init__(self, module_api: ModuleApi, module_config: HubClientApiConfig, media_type: str, is_default: bool, darkmode: bool = False):
		super().__init__()

		self._module_api = module_api
		self._module_config = module_config
		self._darkmode = darkmode
		self._is_default = is_default
		self._media_type = media_type

		if not self._darkmode:
			self.putChild(b'dark', HubMediaResource(module_api, module_config, media_type, is_default, darkmode=True))

	async def _async_render_GET(self, request: SynapseRequest) -> bytes:
		path = self._get_media_path()

		if not os.path.exists(path):
			self._respond_with_default_media(request)
			return

		# File extension is not used because the idea is to always have one hub media image file.
		# Not having file extension makes it easy to override the previous hub media file. 
		with open(path, 'rb') as fd:
			content = fd.read(100)  # Read the first 100 bytes to check if content is svg.
			fd.seek(0)  # Reset file pointer to the beginning for later reading

			# Check if the content starts with XML declaration or a root element
			if content.startswith(b'<?xml') or b'<svg' in content:  # Check for SVG
				request.setHeader(b"Content-Type", b"image/svg+xml")
	
		# Read the file from the beginning and send it as a request
		with open(path, 'rb') as fd:
			request.write(fd.read())
		request.finish()

	async def _async_render_POST(self, request: SynapseRequest) -> bytes:
		if not await self._user_is_admin(request):
			respond_with_json(request, 403, {"message": f"Only Hub admins can upload a Hub {self._media_type}."})
			return  # Important: stop execution after responding

		content_type = request.getHeader("Content-Type")
		if content_type not in ALLOWED_HUB_MEDIA_TYPES:
			respond_with_json(request, 400, {"message": "File type not allowed."})
			return

		# Read the raw binary data from the request body
		media_data = request.content.read()

		# Save the media file
		with open(self._get_media_path(), 'wb') as fd:
			fd.write(media_data)

		request.setHeader(b"Access-Control-Allow-Origin", self._module_config.hub_client_url.encode())
		respond_with_json(request, 200, {"message": f"Hub {self._media_type} uploaded."})

	async def _async_render_DELETE(self, request: SynapseRequest) -> bytes:
		if not await self._user_is_admin(request):
			respond_with_json(request, 403, {"message": f"Only Hub admins can delete a Hub {self._media_type}."})
			return

		media_path = self._get_media_path()
		if os.path.exists(media_path):
			os.remove(media_path)

		request.setHeader(b"Access-Control-Allow-Origin", self._module_config.hub_client_url.encode())
		respond_with_json(request, 200, {"message": f"Hub {self._media_type} deleted."})

	async def _user_is_admin(self, request) -> bool:
		user = await self._module_api.get_user_by_req(request)
		if not await self._module_api.is_user_admin(user.user.to_string()):
			logger.info(f"User {user.user.to_string()} is not an admin.")
			return False

		return True

	def _get_media_path(self) -> str:
		if self._media_type == "icon":
			if self._is_default and self._darkmode:
				return self._module_config.default_hub_icon_dark_path
			elif self._is_default:
				return self._module_config.default_hub_icon_path
			else:
				return self._module_config.hub_icon_path
		elif self._media_type == "banner":
			if self._is_default:
				return self._module_config.default_hub_banner_path
			else:
				return self._module_config.hub_banner_path

	def _respond_with_default_media(self, request: SynapseRequest):
		if self._media_type == "icon":
			default_path = self._module_config.default_hub_icon_dark_path if self._darkmode else self._module_config.default_hub_icon_path
		else:  # banner
			default_path = self._module_config.default_hub_banner_path
			
		with open(default_path, 'rb') as fd:
			request.write(fd.read())
		request.finish()

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
			self._respond_with_default_json(request)
			return
			
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
			return
    
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
	
	def _respond_with_default_json(self, request: SynapseRequest):
		default_path = self._module_config.default_hub_description_path
		
		origin = request.getHeader(b"Origin")
		if origin in [self._module_config.hub_client_url.encode(), self._module_config.global_client_url.encode()]:
			request.setHeader(b"Access-Control-Allow-Origin", origin)
			request.setHeader(b"Content-Type", b"application/json")
			with open(default_path, 'r') as fd:
				request.write(fd.read().encode())
			request.finish()
		else:
			respond_with_json(request, 403, {"message": "Origin not allowed."})
			return



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
            