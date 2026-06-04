from synapse.http.site import SynapseRequest
from synapse.module_api import ModuleApi
from synapse.http.server import DirectServeJsonResource, respond_with_json

from .HubClientApiConfig import HubClientApiConfig
from ._validation import user_validator
from ._cors import set_allow_origin_header
from ._constants import HUB_ADMIN, GUEST

import logging
import os

ALLOWED_HUB_MEDIA_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml"]
# Maximum size for an uploaded hub media file (icon/banner), in bytes.
# Mirrors MAX_HUB_ICON_SIZE in the hub-client (hub-settings.ts).
MAX_HUB_MEDIA_SIZE = 5_000_000  # ~5 MB

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

	@user_validator(GUEST)
	async def _async_render_GET(self, request: SynapseRequest) -> bytes:
		path = self._get_media_path()

		if not os.path.exists(path):
			self._respond_with_default_media(request)
			return

		# File extension is not used because the idea is to always have one hub media image file.
		# Not having file extension makes it easy to override the previous hub media file.
		with open(path, 'rb') as fd:
			content = fd.read()

		request.setHeader(b"Content-Type", self._detect_content_type(content))
		request.write(content)
		request.finish()

	@user_validator(HUB_ADMIN)
	async def _async_render_POST(self, request: SynapseRequest, _) -> bytes:
	
		set_allow_origin_header(request, self._config.allowed_origins)

		content_type = request.getHeader("Content-Type")
		if content_type not in ALLOWED_HUB_MEDIA_TYPES:
			respond_with_json(request, 400, {"message": "File type not allowed."})
			return

		# Read the raw binary data from the request body
		media_data = request.content.read()

		# Reject files that exceed the size limit (the client also checks this,
		# but the limit must be enforced server-side too).
		if len(media_data) > MAX_HUB_MEDIA_SIZE:
			respond_with_json(request, 400, {"message": "File too large."})
			return

		# Validate the actual file contents, not just the client-supplied header.
		detected_type = self._detect_content_type(media_data).decode()
		if detected_type not in ALLOWED_HUB_MEDIA_TYPES:
			respond_with_json(request, 400, {"message": "File type not allowed."})
			return

		# Save the media file
		with open(self._get_media_path(), 'wb') as fd:
			fd.write(media_data)

		respond_with_json(request, 200, {"message": f"Hub {self._media_type} uploaded."})

	@user_validator(HUB_ADMIN)
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
			content = fd.read()

		request.setHeader(b"Content-Type", self._detect_content_type(content))
		request.write(content)
		request.finish()

	def _detect_content_type(self, content: bytes) -> bytes:
		# SVG can be uploaded (see ALLOWED_HUB_MEDIA_TYPES).
		if content.startswith(b'\x89PNG'):
			return b"image/png"
		elif content.startswith(b'\xff\xd8\xff'):
			return b"image/jpeg"
		stripped = content.lstrip()[:512]
		if stripped.startswith(b'<?xml') or b'<svg' in stripped:
			return b"image/svg+xml"
		return b"application/octet-stream"