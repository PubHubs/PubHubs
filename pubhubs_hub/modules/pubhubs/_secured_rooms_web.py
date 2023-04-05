import json
import traceback

from synapse.api.errors import Codes, LoginError
from synapse.handlers.room import RoomCreationHandler, RoomShutdownHandler
from synapse.http.server import DirectServeJsonResource, respond_with_json
from synapse.http.servlet import parse_json_object_from_request
from synapse.http.site import SynapseRequest
from synapse.module_api import ModuleApi
from synapse.types import Requester

from ._secured_rooms_class import SecuredRoom
from ._store import YiviRoomJoinStore


class SecuredRoomsServlet(DirectServeJsonResource):
    """The secured rooms controller containing its basic CRUD functionality."""

    def __init__(self, config: dict, store: YiviRoomJoinStore, api: ModuleApi,
                 room_creation_handler: RoomCreationHandler,
                 room_shutdown_handler: RoomShutdownHandler,
                 server_notices_user: str):
        super().__init__()
        # self.config = config
        self.store = store
        self.module_api = api
        self.room_creation_handler = room_creation_handler
        self.room_shutdown_handler = room_shutdown_handler
        self.server_notices_user = server_notices_user

    async def _async_render_GET(self, request: SynapseRequest):
        """List all secured rooms."""
        await self.assert_is_admin(request)
        rooms = await self.store.get_secured_rooms()
        rooms = [room.to_dict() for room in rooms]
        respond_with_json(request, 200, rooms)
        pass

    async def _async_render_POST(self, request: SynapseRequest):
        """Create a new secured room"""
        user = await self.assert_is_admin(request)

        try:
            request_body = parse_json_object_from_request(request)
            new_room = SecuredRoom(**request_body)
            if new_room.room_id:
                respond_with_json(request, 400, {"errors": "'room_id' cannot be supplied when creating a room."})
                return

            # Adds the room_id
            await new_room.matrix_create(self.module_api, self.room_creation_handler, user.user.to_string(), self.server_notices_user)
            await self.store.create_secured_room(new_room)
            respond_with_json(request, 200, new_room.to_dict())
        except TypeError as e:
            respond_with_json(request, 400, {"errors": f"{str(e)}"})

    async def _async_render_PUT(self, request: SynapseRequest):
        """Update a secured room with the newly send options, will match on the room_id"""
        user = await self.assert_is_admin(request)
        try:
            request_body = parse_json_object_from_request(request)
            updated_room = SecuredRoom(**request_body)
            current_room = await self.store.get_secured_room(updated_room.room_id)
            if current_room:
                if current_room.type.value != updated_room.type.value:
                    respond_with_json(request, 400, {"errors": f"Can't update room type after creation"})
                    return

                await current_room.update_name(updated_room.room_name,self.module_api, user.user.to_string())
                await self.store.update_secured_room(updated_room)
                respond_with_json(request, 200, {"modified": f"{updated_room.room_id}"})
            else:
                respond_with_json(request, 400, {"errors": f"No room with that id"})
        except TypeError as e:
            respond_with_json(request, 400, {"errors": f"{str(e)}"})

    # Will shut down the room as well.
    async def _async_render_DELETE(self, request: SynapseRequest):
        """Delete a secured room"""
        user = await self.assert_is_admin(request)
        try:
            request_body = parse_json_object_from_request(request)
            updated_room = SecuredRoom(**request_body)
            current_room = await self.store.get_secured_room(updated_room.room_id)
            if current_room:
                await self.room_shutdown_handler.shutdown_room(current_room.room_id, user.user.to_string(), block=True)
                await self.store.delete_secured_room(current_room)
                respond_with_json(request, 200, {"deleted": f"{current_room.room_id}"})
            else:
                respond_with_json(request, 400, {"errors": f"No room with that id"})
        except TypeError as e:
            respond_with_json(request, 400, {"errors": f"{str(e)}"})

    async def assert_is_admin(self, request: SynapseRequest) -> Requester:
        user = await self.module_api.get_user_by_req(request)
        if not await self.module_api.is_user_admin(user.user.to_string()):
            raise LoginError(
                401, "Not an admin", errcode=Codes.UNAUTHORIZED
            )
        return user
