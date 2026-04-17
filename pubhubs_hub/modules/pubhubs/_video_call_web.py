import asyncio
import logging
import os
from urllib.parse import urlparse

from livekit import api
from synapse.http.server import DirectServeJsonResource, respond_with_json
from synapse.http.servlet import parse_string
from synapse.http.site import SynapseRequest
from synapse.module_api import ModuleApi

from ._constants import LIVEKIT_API_KEY_DEFAULT, LIVEKIT_API_SECRET_DEFAULT, LIVEKIT_URL
from ._store import HubStore

logger = logging.getLogger(__name__)


def _is_localhost_url(url: str) -> bool:
    parsed = urlparse(url)
    host = parsed.hostname
    return host in {"localhost", "127.0.0.1", "::1"}


def _get_livekit_settings():
    livekit_url = os.getenv("LIVEKIT_URL", LIVEKIT_URL)

    livekit_api_key = os.getenv("LIVEKIT_API_KEY")
    livekit_api_secret = os.getenv("LIVEKIT_API_SECRET")

    if livekit_api_key and livekit_api_secret:
        return livekit_url, livekit_api_key, livekit_api_secret

    if _is_localhost_url(livekit_url):
        return livekit_url, LIVEKIT_API_KEY_DEFAULT, LIVEKIT_API_SECRET_DEFAULT

    raise RuntimeError(
        "LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set when LIVEKIT_URL is not localhost."
    )


async def _create_room(room_name):
    livekit_url, livekit_api_key, livekit_api_secret = _get_livekit_settings()

    lkapi = api.LiveKitAPI(
        livekit_url,
        livekit_api_key,
        livekit_api_secret,
    )
    livekit_rooms = await lkapi.room.list_rooms(api.ListRoomsRequest())

    for room in livekit_rooms.rooms:
        if room.name == room_name:
            return room

    room = await lkapi.room.create_room(api.CreateRoomRequest(name=room_name))

    await lkapi.aclose()


async def _generate_access_token(pseudonym, username, room_name):
    livekit_url, livekit_api_key, livekit_api_secret = _get_livekit_settings()

    token = api.AccessToken(
        livekit_api_key,
        livekit_api_secret,
    ).with_grants(api.VideoGrants(room_join=True, room=room_name)).with_identity(pseudonym).with_name(username).to_jwt()

    return token, livekit_url


class VideoCallServlet(DirectServeJsonResource):
    """The secured rooms controller containing its basic CRUD functionality."""

    def __init__(
            self,
            config: dict,
            store: HubStore,
            api: ModuleApi,
    ):
        super().__init__()
        self.config = config
        self.store = store
        self.module_api = api

    async def _async_render_GET(self, request: SynapseRequest):
        """Get an access token"""

        # Authenticate the user
        user = await self.module_api.get_user_by_req(request)

        pseudonym = user.authenticated_entity + ":" + user.device_id

        room_name = parse_string(request, "room_id")

        if not self.store.is_allowed(user.authenticated_entity, room_name):
            respond_with_json(request, 403, {"error": "User is not allowed to join this room"}, True)
            return

        # Get the name that the user has requested
        token, livekit_url = await _generate_access_token(pseudonym=pseudonym, username=pseudonym, room_name=room_name)

        respond_with_json(request, 200, {"token": token, "livekit_url": livekit_url}, True)

    async def _async_render_POST(self, request: SynapseRequest):
        """Create a new video call room"""

        user = await self.module_api.get_user_by_req(request)

        room_name = parse_string(request, "room_id")

        if not self.store.is_allowed(user.authenticated_entity, room_name):
            respond_with_json(request, 403, {"error": "User is not allowed to join this room"}, True)
            return


        try:
            asyncio.get_event_loop().run_until_complete(_create_room(room_name=room_name))
            respond_with_json(request, 200, {}, True)
        except TypeError as e:
            logger.exception("Failed to create LiveKit room")
            respond_with_json(request, 400, {"errors": f"{str(e)}"}, True)
