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
from synapse.api.constants import EventTypes

from ._secured_rooms_class import SecuredRoom
from ._store import YiviRoomJoinStore

logger = logging.getLogger(__name__)

MODERATOR_POWER_LEVEL = 50

class SecuredRoomsServlet(DirectServeJsonResource):
    """The secured rooms controller containing its basic CRUD functionality."""

    def __init__(
        self,
        config: dict,
        store: YiviRoomJoinStore,
        api: ModuleApi,
        room_creation_handler: RoomCreationHandler,
        room_shutdown_handler: RoomShutdownHandler,
        server_notices_user: str,
    ):
        super().__init__()
        # self.config = config
        self.store = store
        self.module_api = api
        self.room_creation_handler = room_creation_handler
        self.room_shutdown_handler = room_shutdown_handler
        self.server_notices_user = server_notices_user

    async def _async_render_GET(self, request: SynapseRequest):
        """List all secured rooms."""
        user = await self.module_api.get_user_by_req(request)
        is_mod = await self.assert_is_moderator( request, user)
        if is_mod:
            room_id = self.get_room_id_from_request(request)
            room = await self.store.get_secured_room(room_id)
            respond_with_json(request, 200, room.to_dict(), True)
            return
    
        # Admin check
        await self.assert_is_admin(user)    
        rooms = await self.store.get_secured_rooms()
        rooms = [room.to_dict() for room in rooms]
        respond_with_json(request, 200, rooms, True)
        return 

    async def _async_render_POST(self, request: SynapseRequest):
        
        """Create a new secured room"""
        user = await self.module_api.get_user_by_req(request)
        await self.assert_is_admin(user)
                
        try:
            request_body = parse_json_object_from_request(request)
            new_room = SecuredRoom(**request_body)
            if new_room.room_id:
                respond_with_json(request, 400, {"errors": "'room_id' cannot be supplied when creating a room."}, True)
                return

            # Adds the room_id
            await new_room.matrix_create(
                self.module_api, self.room_creation_handler, user.user.to_string(), self.server_notices_user
            )
            await self.store.create_secured_room(new_room)
            respond_with_json(request, 200, new_room.to_dict(), True)
        except TypeError as e:
            respond_with_json(request, 400, {"errors": f"{str(e)}"}, True)

    async def _async_render_PUT(self, request: SynapseRequest):
        """Update a secured room with the newly send options, will match on the room_id"""
        user = await self.module_api.get_user_by_req(request)
        
        # Put request contains a body with the updated room options
        request_body = parse_json_object_from_request(request)
        updated_room = SecuredRoom(**request_body)
        # First check whether the user is a moderator
        is_mod = await self.assert_is_moderator( request, user, updated_room.room_id)

        # If the user is not a moderator, then check whether the user is an admin
        if not is_mod:
            await self.assert_is_admin(user)
        try:
            
            current_room = await self.store.get_secured_room(updated_room.room_id)
            if current_room:
                if current_room.type.value != updated_room.type.value:
                    respond_with_json(request, 400, {"errors": f"Can't update room type after creation"}, True)
                    return

                await current_room.update_name(updated_room.name, self.module_api, user.user.to_string())
                await current_room.update_topic(updated_room.topic, self.module_api, user.user.to_string())
                await self.store.update_secured_room(updated_room)
                respond_with_json(request, 200, {"modified": f"{updated_room.room_id}"}, True)
            else:
                respond_with_json(request, 400, {"errors": f"No room with that id"}, True)
        except TypeError as e:
            respond_with_json(request, 400, {"errors": f"{str(e)}"}, True)

    # Will shut down the room as well.
    async def _async_render_DELETE(self, request: SynapseRequest):
        """Delete a secured room"""
        user = await self.module_api.get_user_by_req(request)
        await self.assert_is_admin(user)
        try:
            room_id = parse_string(request, "room_id")

            if not room_id:
                respond_with_json(request, 400, {"errors": "Please supply query parameter 'room_id'"}, True)
                return

            current_room = await self.store.get_secured_room(room_id)
            if current_room:
                shutdownParams:ShutdownRoomParams = {'block' : True,'purge' : False,'force_purge' : False,'requester_user_id':user.user.to_string(),'new_room_user_id': None,'new_room_name': None,'message': None}
                await self.room_shutdown_handler.shutdown_room(current_room.room_id, shutdownParams)
                await self.store.delete_secured_room(current_room)
                respond_with_json(request, 200, {"deleted": f"{current_room.room_id}"}, True)
            else:
                respond_with_json(request, 400, {"errors": f"No room with that id"}, True)
        except TypeError as e:
            respond_with_json(request, 400, {"errors": f"{str(e)}"}, True)

    async def assert_is_admin(self, user) -> Requester:
        if not await self.module_api.is_user_admin(user.user.to_string()):
            raise LoginError(401, "Not an admin", errcode=Codes.UNAUTHORIZED)
        return user

    async def assert_is_moderator(self, request: SynapseRequest, user, room_id = None) -> bool:
        # Initialize with default power level
        user_power_level = 0;

        # If room Id is not provided, then get it from the request
        if room_id == None:
            room_id = self.get_room_id_from_request(request)
      
        if room_id:
            roomEvent = await self.module_api.get_room_state(room_id, [(EventTypes.PowerLevels, "")])
            power_levels_event = roomEvent.get(('m.room.power_levels', ''))
            if power_levels_event:
                    power_levels = power_levels_event.content             
                    user_id = user.user;
                    user_power_level = self.get_user_power_level(user_id, power_levels)
    
        return user_power_level == MODERATOR_POWER_LEVEL;
    
    def get_room_id_from_request(self,request):
        if isinstance(request, dict):  # Test case scenario where request is a dict
            room_id_bytes = request.get(b'room_id', [None])[0]
        else:  # Normal case where request has 'args' attribute
            room_id_bytes = request.args.get(b'room_id', [None])[0]
    
        if room_id_bytes:
            return room_id_bytes.decode('utf-8')
    
        return None      
                
    def get_user_power_level(self, user_id, power_levels_dict):
        logger.info(f"Power levels dict: {power_levels_dict}")
        # Extract users and users_default from the dictionary
        user_id_str = user_id.to_string()
        users = power_levels_dict.get('users')
        logger.info(f"Users in dictionary: {users}")
        if user_id_str in users:
            return users[user_id_str]
        # Return the user's power level if they exist, otherwise return the default
        return 0



class NoticesServlet(DirectServeJsonResource):
    def __init__(self, server_notices_user: str):
        super().__init__()
        # self.config = config
        self.server_notices_user = server_notices_user

    async def _async_render_GET(self, request: SynapseRequest):
        """Returns the Hub Notice"""
        notice = self.server_notices_user
        logger.info(f" Getting notice {notice}...")
        respond_with_json(request, 200, notice, True)
        pass


# Non-admin requests for getting information about secured rooms based on room Id.
class SecuredRoomExtraServlet(DirectServeJsonResource):
    def __init__(self, store: str, module_api: ModuleApi):
        super().__init__()
        # self.config = config
        self.store = store
        self.module_api = module_api

    async def _async_render_GET(self, request: SynapseRequest):
        """Returns the Hub Notice"""

        if not request.args.get(b"room_id"):
            return respond_with_json(request, 400, {})

        room_id = b"".join(request.args.get(b"room_id")).decode()

        allowed_secured_room_info = await self.store.get_secured_room(room_id)
        response_in_json = json.dumps(allowed_secured_room_info, default=lambda o: o.__dict__)
        respond_with_json(request, 200, response_in_json, True)
        pass
