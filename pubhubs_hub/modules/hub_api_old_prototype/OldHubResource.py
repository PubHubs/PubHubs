from synapse.http.site import SynapseRequest
from synapse.module_api import ModuleApi
from twisted.web import server
from synapse.http.server import DirectServeJsonResource, respond_with_json
import json
import logging

from .OldHubStore import HubStore
import os

logger = logging.getLogger("synapse.contrib." + __name__)

def tuple_to_json_bytes(literal: tuple) -> bytes:
	return bytes(json.dumps(literal), 'utf-8')


class HubResource(DirectServeJsonResource):
	"""
	Synapse lets us add api endpoints by adding implementations of Twisted's IResource interface.
	We extend Twisted's Resource class here, which implements IResource.
	"""

	def __init__(self, store: HubStore, module_api: ModuleApi):
		super().__init__()
		self.store = store

		self.putChild(b'icon', HubIconResource(store, module_api))

	async def _async_render_GET(self, request: SynapseRequest) -> bytes:
		hub_info = await self.store.get_hub_info()
		hub_json = json.dumps(hub_info)
		logger.info(f"Hub info: {hub_json}")
		byte = bytes(hub_json, 'utf-8')
		logger.info(f"Hub info byte: {byte}")
		respond_with_json(request, 200, hub_info)

	def render_POST(self, request: SynapseRequest) -> bytes:
		hub = json.loads(request.content.read())
		self.store.create_hub(hub)


class HubIconResource(DirectServeJsonResource):
	def __init__(self, store: HubStore, module_api: ModuleApi):
		super().__init__()
		self.store = store
		self.module_api = module_api

	async def _async_render_GET(self, request: SynapseRequest) -> bytes:
		with open('/data/hub_logo.png', 'rb') as fd:
			request.write(fd.read())
		request.finish()

	async def _async_render_POST(self, request: SynapseRequest) -> bytes:
		user = await self.module_api.get_user_by_req(request)
		if not await self.module_api.is_user_admin(user.user.to_string()):
			logger.info(f"User {user.user.to_string()} is not an admin.")
			respond_with_json(request, 403, {"error": "Forbidden"})

		with open('/data/hub_logo.png', 'wb') as fd:
				fd.write(request.args[b'blob'][0])

		request.setHeader(b"Access-Control-Allow-Origin", f"http://localhost:8801".encode())
		respond_with_json(request, 200, {"message": "Logo uploaded."})

	async def _async_render_DELETE(self, request: SynapseRequest) -> bytes:
		user = await self.module_api.get_user_by_req(request)
		if not await self.module_api.is_user_admin(user.user.to_string()):
			logger.info(f"User {user.user.to_string()} is not an admin.")
			respond_with_json(request, 403, {"error": "Forbidden"})

		if os.path.exists('/data/hub_logo.png'):
			os.remove('/data/hub_logo.png')

		request.setHeader(b"Access-Control-Allow-Origin", f"http://localhost:8801".encode())
		respond_with_json(request, 200, {"message": "Logo deleted."})
