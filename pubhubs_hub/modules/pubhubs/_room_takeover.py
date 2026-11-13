"""Lets a hub admin become room admin of a room, also when every admin of the room has left it.

Synapse's make_room_admin admin API can only hand out power through a local user who is still in the room, so it fails
once the room's admins have left. Matrix only accepts the power levels change from a joined member, so here the local
user with the most power rejoins for the moment it takes to send it. That happens server side: no access token of
that user ever leaves the server.

The rejoin is a real membership change: the room's members see the former admin join and leave again under their
pseudonym, next to the power levels change that names the hub admin.
"""

import logging
from typing import Callable

from synapse.api.constants import EventTypes, Membership
from synapse.api.errors import SynapseError
from synapse.http.server import DirectServeJsonResource, respond_with_json
from synapse.http.servlet import parse_json_object_from_request
from synapse.http.site import SynapseRequest
from synapse.module_api import ModuleApi

from ._constants import HUB_ADMIN, ROOM_ADMIN
from ._cors import set_allow_origin_header
from ._errors import BadRequestError, ConflictError, NotFoundError
from ._hub_client_api_config import HubClientApiConfig
from ._spam_checker import SpamChecker
from ._validation import get_user_power_level, user_validator

logger = logging.getLogger("synapse.contrib." + __name__)

# Matrix's state_default when a power levels event leaves it out
DEFAULT_STATE_POWER_LEVEL = 50

# Rooms with a takeover in progress. Two at once could have one granter leave while the other still needs them, and
# each would write back power levels without the other's change. Synapse runs modules on a single reactor thread, so
# a plain set is enough.
_rooms_being_taken_over: set[str] = set()


def find_granters(power_levels: dict, joined_user_ids: set[str], is_mine: Callable[[str], bool]) -> list[str]:
    """
    The local users who may change the power levels, most powerful first and at the same level joined ones first, so
    nobody has to rejoin when that can be avoided.

    Args:
        power_levels: content of the room's m.room.power_levels
        joined_user_ids: the users currently joined to the room
        is_mine: whether a user belongs to this hub
    """
    # Only users listed in "users": the creators of v12+ rooms aren't, see get_user_power_level
    required = power_levels.get("events", {}).get(EventTypes.PowerLevels, power_levels.get("state_default", DEFAULT_STATE_POWER_LEVEL))
    candidates = [
        (level, user_id in joined_user_ids, user_id)
        for user_id, level in power_levels.get("users", {}).items()
        if level >= required and is_mine(user_id)
    ]
    return [user_id for _, _, user_id in sorted(candidates, reverse=True)]


async def _get_power_levels(module_api: ModuleApi, room_id: str) -> dict:
    state = await module_api.get_room_state(room_id, [(EventTypes.PowerLevels, "")])
    power_levels_event = state.get((EventTypes.PowerLevels, ""))
    if power_levels_event is None:
        raise NotFoundError("Room not found")
    return power_levels_event.content


async def _grant(module_api: ModuleApi, room_id: str, granter: str, user_id: str) -> int:
    """
    Has granter give user_id their own power level. The power levels are read again right before sending, since a
    rejoin takes a while and the levels may have changed meanwhile.
    """
    power_levels = await _get_power_levels(module_api, room_id)
    granter_level = get_user_power_level(granter, power_levels)
    await module_api.create_and_send_event_into_room(
        {
            "type": EventTypes.PowerLevels,
            "room_id": room_id,
            "sender": granter,
            "state_key": "",
            "content": {**power_levels, "users": {**power_levels.get("users", {}), user_id: granter_level}},
        }
    )
    return granter_level


async def _rejoin(module_api: ModuleApi, spam_checker: SpamChecker, room_id: str, granter: str) -> bool:
    """
    Rejoins granter to the room.

    Returns:
        whether it worked; it doesn't when e.g. the room is invite only or the granter was banned
    """
    # They may no longer have disclosed the attributes a secured room asks for
    spam_checker.allow_join(granter, room_id)
    try:
        await module_api.update_room_membership(granter, granter, room_id, Membership.JOIN)
        return True
    except SynapseError as error:
        logger.warning(f"Room takeover of {room_id}: {granter} could not rejoin: {error}")
        return False
    finally:
        spam_checker.revoke_join(granter, room_id)


async def _leave(module_api: ModuleApi, room_id: str, granter: str) -> None:
    try:
        await module_api.update_room_membership(granter, granter, room_id, Membership.LEAVE)
    except Exception:
        # The power has been handed over by now (or not), so don't let this hide how that went
        logger.exception(f"Room takeover of {room_id}: {granter} rejoined but could not leave again")


async def take_over_room(module_api: ModuleApi, spam_checker: SpamChecker, room_id: str, user_id: str) -> int:
    """
    Gives user_id the power level of the room's most powerful local user who can still be joined to the room. That
    may be below room admin, when nobody left on the hub is room admin.

    Returns:
        the power level user_id has afterwards

    Raises:
        NotFoundError if the room has no power levels, i.e. doesn't exist here
        ConflictError if no local user can raise user_id, or another takeover of the room is in progress
    """
    if room_id in _rooms_being_taken_over:
        raise ConflictError("This room is already being taken over")
    _rooms_being_taken_over.add(room_id)
    try:
        state = await module_api.get_room_state(room_id, [(EventTypes.PowerLevels, ""), (EventTypes.Member, None)])
        power_levels_event = state.get((EventTypes.PowerLevels, ""))
        if power_levels_event is None:
            raise NotFoundError("Room not found")
        power_levels = power_levels_event.content

        current_level = get_user_power_level(user_id, power_levels)
        if current_level >= ROOM_ADMIN:
            return current_level

        joined_user_ids = {
            state_key for (event_type, state_key), event in state.items() if event_type == EventTypes.Member and event.membership == Membership.JOIN
        }
        for granter in find_granters(power_levels, joined_user_ids, module_api.is_mine):
            granter_level = get_user_power_level(granter, power_levels)
            if granter_level <= current_level:
                # The rest have no more power than this one
                break

            if granter in joined_user_ids:
                return await _grant(module_api, room_id, granter, user_id)

            logger.info(f"{user_id} takes over room {room_id}: {granter} rejoins to hand over power level {granter_level}")
            if not await _rejoin(module_api, spam_checker, room_id, granter):
                continue
            try:
                return await _grant(module_api, room_id, granter, user_id)
            finally:
                await _leave(module_api, room_id, granter)

        raise ConflictError("Nobody on this hub has the power to make you room admin")
    finally:
        _rooms_being_taken_over.discard(room_id)


class RoomTakeoverServlet(DirectServeJsonResource):
    """
    POST /_synapse/client/take_over_room with body {"room_id": ...}

    Makes the requesting hub admin room admin of the room, or as close to it as the hub's users can. Responds with
    {"power_level": ...}, the level they have afterwards. Joining the room is left to the client.
    """

    isLeaf = True

    def __init__(self, module_api: ModuleApi, config: HubClientApiConfig, spam_checker: SpamChecker):
        super().__init__()
        self._module_api = module_api
        self._config = config
        self._spam_checker = spam_checker

    @user_validator(HUB_ADMIN)
    async def _async_render_POST(self, request: SynapseRequest, user_id: str) -> None:
        set_allow_origin_header(request, self._config.allowed_origins)

        room_id = parse_json_object_from_request(request).get("room_id")
        if not isinstance(room_id, str) or not room_id:
            raise BadRequestError("room_id is required in the request body")

        power_level = await take_over_room(self._module_api, self._spam_checker, room_id, user_id)
        respond_with_json(request, 200, {"power_level": power_level}, True)
