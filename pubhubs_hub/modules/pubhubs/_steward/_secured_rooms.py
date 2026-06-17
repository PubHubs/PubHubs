"""Steward secured rooms endpoints.

This module allows stewards (power level 50+) to view and manage secured rooms
they moderate.
"""

import logging

from synapse.http.server import DirectServeJsonResource, respond_with_json
from synapse.http.servlet import parse_json_object_from_request
from synapse.http.site import SynapseRequest
from synapse.module_api import ModuleApi

from ..HubClientApiConfig import HubClientApiConfig
from .._constants import STEWARD
from .._cors import set_allow_origin_header
from .._errors import BadRequestError
from .._secured_rooms_class import SecuredRoom
from .._store import HubStore
from .._validation import user_validator, get_room_id_from_request

logger = logging.getLogger("synapse.contrib." + __name__)


class StewardSecuredRoomsServlet(DirectServeJsonResource):
    """Servlet for stewards to view and update secured rooms they moderate.

    Endpoints:
        GET /_synapse/client/steward/secured_rooms?room_id=...
            Get a specific secured room (requires STEWARD power level)

        PUT /_synapse/client/steward/secured_rooms
            Update a secured room (requires STEWARD power level in that room)
    """

    isLeaf = False

    def __init__(
        self,
        module_api: ModuleApi,
        config: HubClientApiConfig,
        store: HubStore,
    ):
        super().__init__()
        self._module_api = module_api
        self._config = config
        self._store = store

    def getChild(self, name: bytes, request: SynapseRequest) -> "DirectServeJsonResource":
        """Handle child paths."""
        if name == b"remove_users":
            return StewardRemoveUsersServlet(
                self._module_api,
                self._config,
                self._store,
            )
        return self

    @user_validator(STEWARD)
    async def _async_render_GET(self, request: SynapseRequest, user_id: str) -> None:
        """Get a specific secured room.

        Query parameters:
            room_id (required): The room to get
        """
        set_allow_origin_header(request, self._config.allowed_origins)

        room_id = get_room_id_from_request(request)
        if not room_id:
            raise BadRequestError("room_id query parameter is required")

        room = await self._store.get_secured_room(room_id)
        if not room:
            respond_with_json(request, 404, {"error": "Secured room not found"}, True)
            return

        respond_with_json(request, 200, room.to_dict(), True)

    @user_validator(STEWARD)
    async def _async_render_PUT(self, request: SynapseRequest, user_id: str) -> None:
        """Update a secured room.

        The room_id in the request body is used to check steward power level.

        Request body:
            room_id (required): The room to update
            name (optional): New room name
            topic (optional): New room topic
            accepted (optional): Updated accepted attributes
            expiration_time_days (optional): Updated expiration time
            user_txt (optional): Updated user text
        """
        set_allow_origin_header(request, self._config.allowed_origins)

        request_body = parse_json_object_from_request(request)
        updated_room = SecuredRoom(**request_body)

        if not updated_room.room_id:
            raise BadRequestError("room_id is required in the request body")

        current_room = await self._store.get_secured_room(updated_room.room_id)
        if not current_room:
            respond_with_json(request, 404, {"error": "Secured room not found"}, True)
            return

        if current_room.type.value != updated_room.type.value:
            respond_with_json(
                request, 400, {"error": "Cannot update room type after creation"}, True
            )
            return

        await current_room.update_name(updated_room.name, self._module_api, user_id)
        await current_room.update_topic(updated_room.topic, self._module_api, user_id)
        await self._store.update_secured_room(updated_room)

        respond_with_json(request, 200, {"modified": updated_room.room_id}, True)


class StewardRemoveUsersServlet(DirectServeJsonResource):
    """Servlet for stewards to remove all users from a secured room.

    Endpoint:
        POST /_synapse/client/steward/secured_rooms/remove_users
            Remove all users from a secured room (requires STEWARD power level)
    """

    isLeaf = True

    def __init__(
        self,
        module_api: ModuleApi,
        config: HubClientApiConfig,
        store: HubStore,
    ):
        super().__init__()
        self._module_api = module_api
        self._config = config
        self._store = store

    @user_validator(STEWARD)
    async def _async_render_POST(self, request: SynapseRequest, user_id: str) -> None:
        """Remove all users from a secured room.

        Request body:
            room_id (required): The room to remove users from
        """
        set_allow_origin_header(request, self._config.allowed_origins)

        request_body = parse_json_object_from_request(request)
        room_id = request_body.get("room_id")

        if not room_id:
            raise BadRequestError("room_id is required in the request body")

        # Verify the room exists
        room = await self._store.get_secured_room(room_id)
        if not room:
            respond_with_json(request, 404, {"error": "Secured room not found"}, True)
            return

        await self._store.remove_users_from_secured_room(room_id)

        respond_with_json(request, 200, {"success": True}, True)
