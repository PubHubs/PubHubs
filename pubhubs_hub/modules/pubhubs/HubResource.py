from synapse.http.site import SynapseRequest
from synapse.module_api import ModuleApi
from synapse.http.server import DirectServeJsonResource, respond_with_json
import logging
import os

from .HubClientApiConfig import HubClientApiConfig

logger = logging.getLogger("synapse.contrib." + __name__)

ALLOWED_HUB_ICON_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml"]

class HubResource(DirectServeJsonResource):
	"""
	Synapse lets us add api endpoints by adding implementations of Twisted's IResource interface.
	We use synapse.http.server.DirectServeJsonResource here, which is an undocumented class from Synapse.
	This is not ideal, but we didn't get async responses to work without it.
	"""

	_module_api: ModuleApi
	_module_config: HubClientApiConfig

	def __init__(self, module_api: ModuleApi, module_config: HubClientApiConfig):
		super().__init__()

		self._module_api = module_api
		self._module_config = module_config

		self.putChild(b'icon', HubIconResource(module_api, module_config, False))
		self.putChild(b'default-icon', HubIconResource(module_api, module_config, True))

class HubIconResource(DirectServeJsonResource):
	_module_api: ModuleApi
	_module_config: HubClientApiConfig
	_darkmode: bool
	_default_icon: bool

	def __init__(self, module_api: ModuleApi, module_config: HubClientApiConfig, default_icon: bool, darkmode: bool = False):
		super().__init__()

		self._module_api = module_api
		self._module_config = module_config
		self._darkmode = darkmode
		self._default_icon = default_icon

		if not self._darkmode:
			self.putChild(b'dark', HubIconResource(module_api, module_config, default_icon, darkmode=True))

	async def _async_render_GET(self, request: SynapseRequest) -> bytes:
		path = self._get_icon_path()

		if not os.path.exists(path):
			self._respond_with_default_icon(request)
			return

  		# File extension is not used because it seems like the idea is to always have one hub_icon image file.
		# Not having file extension makes it easly to override the previous hub_icon file. 
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
			respond_with_json(request, 403, {"message": "Only Hub admins can upload a Hub icon."})
			return  #  Important: stop execution after responding

		content_type = request.getHeader("Content-Type")
		if content_type not in ALLOWED_HUB_ICON_TYPES:
			respond_with_json(request, 400, {"message": "File type not allowed."})
			return

		# Read the raw binary data from the request body
		icon_data = request.content.read()

		# Save the icon file
		with open(self._get_icon_path(), 'wb') as fd:
			fd.write(icon_data)

		request.setHeader(b"Access-Control-Allow-Origin", self._module_config.hub_client_url.encode())
		respond_with_json(request, 200, {"message": "Hub icon uploaded."})


	async def _async_render_DELETE(self, request: SynapseRequest) -> bytes:
		if not await self._user_is_admin(request):
			respond_with_json(request, 403, {"message": "Only Hub admins can delete a Hub icon."})

		if os.path.exists(self._module_config.hub_icon_path):
			os.remove(self._module_config.hub_icon_path)

		request.setHeader(b"Access-Control-Allow-Origin", self._module_config.hub_client_url.encode())
		respond_with_json(request, 200, {"message": "Hub icon deleted."})

	async def _user_is_admin(self, request) -> bool:
		user = await self._module_api.get_user_by_req(request)
		if not await self._module_api.is_user_admin(user.user.to_string()):
			logger.info(f"User {user.user.to_string()} is not an admin.")
			return False

		return True

	def _get_icon_path(self) -> str:
		if self._default_icon and self._darkmode:
			return self._module_config.default_hub_icon_dark_path
		elif self._default_icon:
			return self._module_config.default_hub_icon_path
		elif self._darkmode:
			# For now we don't make a distinction between dark and light icons.
			return self._module_config.hub_icon_path
		else:
			return self._module_config.hub_icon_path

	def _respond_with_default_icon(self, request: SynapseRequest):
		if self._darkmode:
			with open(self._module_config.default_hub_icon_dark_path, 'rb') as fd:
				request.write(fd.read())
			request.finish()
		else:
			with open(self._module_config.default_hub_icon_path, 'rb') as fd:
				request.write(fd.read())
			request.finish()
