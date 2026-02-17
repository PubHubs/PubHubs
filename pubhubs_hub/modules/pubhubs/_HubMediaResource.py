from synapse.http.site import SynapseRequest
from synapse.module_api import ModuleApi
from synapse.http.server import DirectServeJsonResource, respond_with_json

from .HubClientApiConfig import HubClientApiConfig
from ._validation import user_validator
from ._cors import set_allow_origin_header

import logging
import os

ALLOWED_HUB_MEDIA_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml"]

logger = logging.getLogger("synapse.contrib." + __name__)

class HubMediaResource(DirectServeJsonResource):
	_module_api: ModuleApi
	_config: HubClientApiConfig
	_darkmode: bool
	_is_default: bool
	_media_type: str  # Either "icon" or "banner"

	def __init__(self, module_api: ModuleApi, config: HubClientApiConfig, media_type: str, is_default: bool, darkmode: bool = False):
		super().__init__()

		self._module_api = module_api
		self._config = config
		self._darkmode = darkmode
		self._is_default = is_default
		self._media_type = media_type

		if not self._darkmode:
			self.putChild(b'dark', HubMediaResource(self._module_api, self._config, media_type, self._is_default, darkmode=True))

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

	@user_validator(require_admin=True)
	async def _async_render_POST(self, request: SynapseRequest, _) -> bytes:
	
		set_allow_origin_header(request, self._config.allowed_origins)

		content_type = request.getHeader("Content-Type")
		if content_type not in ALLOWED_HUB_MEDIA_TYPES:
			respond_with_json(request, 400, {"message": "File type not allowed."})
			return

		# Read the raw binary data from the request body
		media_data = request.content.read()

		# Save the media file
		with open(self._get_media_path(), 'wb') as fd:
			fd.write(media_data)

		respond_with_json(request, 200, {"message": f"Hub {self._media_type} uploaded."})

	@user_validator(require_admin=True)
	async def _async_render_DELETE(self, request: SynapseRequest, _) -> bytes:

		set_allow_origin_header(request, self._config.allowed_origins)

		media_path = self._get_media_path()
		if os.path.exists(media_path):
			os.remove(media_path)


		
		respond_with_json(request, 200, {"message": f"Hub {self._media_type} deleted."})

	def _get_media_path(self) -> str:
		if self._media_type == "icon":
			if self._is_default and self._darkmode:
				return self._config.default_hub_icon_dark_path
			elif self._is_default:
				return self._config.default_hub_icon_path
			else:
				return self._config.hub_icon_path
		elif self._media_type == "banner":
			if self._is_default:
				return self._config.default_hub_banner_path
			else:
				return self._config.hub_banner_path

	def _respond_with_default_media(self, request: SynapseRequest):
		if self._media_type == "icon":
			default_path = self._config.default_hub_icon_dark_path if self._darkmode else self._config.default_hub_icon_path
		else:  # banner
			default_path = self._config.default_hub_banner_path
			
		with open(default_path, 'rb') as fd:
			request.write(fd.read())
		request.finish()