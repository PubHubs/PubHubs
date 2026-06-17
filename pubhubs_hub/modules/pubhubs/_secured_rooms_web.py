import json
import traceback
import logging

from synapse.api.errors import Codes, LoginError
from synapse.handlers.room import RoomCreationHandler, RoomShutdownHandler
from synapse.http.server import DirectServeJsonResource, respond_with_json
from synapse.http.servlet import parse_json_object_from_request, parse_string
from synapse.http.site import SynapseRequest
from synapse.module_api import ModuleApi
from synapse.types import Requester

from .HubClientApiConfig import HubClientApiConfig
from ._validation import user_validator
from ._cors import set_allow_origin_header
from ._constants import HUB_ADMIN
from ._secured_rooms_class import SecuredRoom
from ._store import HubStore

logger = logging.getLogger(__name__)

class SecuredRoomsServlet(DirectServeJsonResource):
    """The secured rooms controller containing its basic CRUD functionality."""

    def __init__(
        self,
        config: HubClientApiConfig,
        store: HubStore,
        api: ModuleApi,
        room_creation_handler: RoomCreationHandler,
        room_shutdown_handler: RoomShutdownHandler,
    ):
        super().__init__()
        self._config = config
        self._store = store
        self._module_api = api
        self._room_creation_handler = room_creation_handler
        self._room_shutdown_handler = room_shutdown_handler

    @user_validator(HUB_ADMIN)
    async def _async_render_GET(self, request: SynapseRequest, user_id: str):
        """List all secured rooms. Admin only."""
        set_allow_origin_header(request, self._config.allowed_origins)

        rooms = await self._store.get_secured_rooms()
        rooms = [room.to_dict() for room in rooms]
        respond_with_json(request, 200, rooms, True)

    @user_validator(HUB_ADMIN)
    async def _async_render_POST(self, request: SynapseRequest, user_id: str):
        """Create a new secured room"""
        set_allow_origin_header(request, self._config.allowed_origins)
            
        request_body = parse_json_object_from_request(request)
        new_room = SecuredRoom(**request_body)
        if new_room.room_id:
            respond_with_json(request, 400, {"errors": "'room_id' cannot be supplied when creating a room."}, True)
            return

        # Adds the room_id
        await new_room.matrix_create(
            self._module_api, self._room_creation_handler, user_id, self._config.server_notices_user
        )
        await self._store.create_secured_room(new_room)
        respond_with_json(request, 200, new_room.to_dict(), True)


    @user_validator(HUB_ADMIN)
    async def _async_render_PUT(self, request: SynapseRequest, user_id: str):
        """Update a secured room with the newly send options, will match on the room_id. Admin only."""
        set_allow_origin_header(request, self._config.allowed_origins)

        request_body = parse_json_object_from_request(request)
        updated_room = SecuredRoom(**request_body)

        current_room = await self._store.get_secured_room(updated_room.room_id)
        if current_room:
            if current_room.type.value != updated_room.type.value:
                respond_with_json(request, 400, {"errors": "Cannot update room type after creation"}, True)
                return

            await current_room.update_name(updated_room.name, self._module_api, user_id)
            await current_room.update_topic(updated_room.topic, self._module_api, user_id)
            await self._store.update_secured_room(updated_room)
            respond_with_json(request, 200, {"modified": updated_room.room_id}, True)
        else:
            respond_with_json(request, 400, {"errors": "No room with that id"}, True)


    # Will shut down the room as well.
    @user_validator(HUB_ADMIN)
    async def _async_render_DELETE(self, request: SynapseRequest, user_id: str):
        """Delete a secured room"""

        set_allow_origin_header(request, self._config.allowed_origins)
    
    
        room_id = parse_string(request, "room_id")

        if not room_id:
            respond_with_json(request, 400, {"errors": "Please supply query parameter 'room_id'"}, True)
            return

        current_room = await self._store.get_secured_room(room_id)
        if current_room:
            shutdownParams:ShutdownRoomParams = {'block' : True,'purge' : True,'force_purge' : False,'requester_user_id':user_id,'new_room_user_id': None,'new_room_name': None,'message': None}
            await self._room_shutdown_handler.shutdown_room(current_room.room_id, shutdownParams)
            await self._store.delete_secured_room(current_room)
            respond_with_json(request, 200, {"deleted": f"{current_room.room_id}"}, True)
        else:
            respond_with_json(request, 400, {"errors": f"No room with that id"}, True)

class NoticesServlet(DirectServeJsonResource):
    def __init__(self, server_notices_user: str):
        super().__init__()
        self._server_notices_user = server_notices_user

    async def _async_render_GET(self, request: SynapseRequest):
        """Returns the Hub Notice"""
        notice = self._server_notices_user
        logger.info(f" Getting notice {notice}...")
        respond_with_json(request, 200, notice, True)


# Non-admin requests for getting information about secured rooms based on room Id.
class SecuredRoomExtraServlet(DirectServeJsonResource):
    def __init__(self, store: str, module_api: ModuleApi):
        super().__init__()
        self._store = store
        self._module_api = module_api

    async def _async_render_GET(self, request: SynapseRequest):
        """Returns the Hub Notice"""

        if not request.args.get(b"room_id"):
            return respond_with_json(request, 400, {})

        room_id = b"".join(request.args.get(b"room_id")).decode()

        allowed_secured_room_info = await self._store.get_secured_room(room_id)
        response_in_json = json.dumps(allowed_secured_room_info, default=lambda o: o.__dict__)
        respond_with_json(request, 200, response_in_json, True)
