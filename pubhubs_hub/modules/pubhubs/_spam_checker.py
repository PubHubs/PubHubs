import logging
from typing import Union

from synapse.api.constants import EventTypes
from synapse.module_api import ModuleApi

from ._constants import EXPERT_VERIFICATION_MSGTYPE, EXPERT
from ._store import HubStore

logger = logging.getLogger("synapse.contrib." + __name__)


class SpamChecker:
    """
    Spam checker callbacks for PubHubs-specific validation.

    Registered callbacks:
    - user_may_join_room: Controls access to secured rooms
    - check_event_for_spam: Validates expert verification messages
    """

    def __init__(self, module_api: ModuleApi, store: HubStore):
        self.module_api = module_api
        self.store = store

    async def user_may_join_room(self, user: str, room: str, invited: bool) -> bool:
        """
        Spam checker callback for user_may_join_room.

        Will check if user is allowed to join the room (correct attributes revealed through Yivi).

        See: https://matrix-org.github.io/synapse/v1.48/modules/spam_checker_callbacks.html#user_may_join_room
        """
        logger.debug(f"user_may_join_room: user='{user}' room='{room}' invited={invited}")

        secured_room = await self.store.get_secured_room(room)
        if secured_room:
            return await self.store.is_allowed(user, room)

        # Fallthrough: allow joining rooms that don't require attribute disclosure
        return True

    async def check_event_for_spam(self, event) -> Union[str, bool]:
        """
        Spam checker callback to enforce that only experts can send expert verification messages.
        Uses power levels (>= 25) to determine expert status.

        Returns:
            - False to allow the event
            - A string error message to block the event
        """
        # Only check room messages
        if event.type != "m.room.message":
            return False

        content = event.content
        msgtype = content.get("msgtype")

        # Only check expert verification messages
        if msgtype != EXPERT_VERIFICATION_MSGTYPE:
            return False

        room_id = event.room_id
        sender = event.sender

        # Get power levels to check if sender is an expert (power level >= 25)
        try:
            state = await self.module_api.get_room_state(room_id, [(EventTypes.PowerLevels, "")])
            power_levels_event = state.get((EventTypes.PowerLevels, ""))

            if power_levels_event is None:
                logger.warning(f"Expert verification blocked: no power levels in room {room_id}")
                return "Could not verify expert status"

            users = power_levels_event.content.get("users", {})
            users_default = power_levels_event.content.get("users_default", 0)
            user_power_level = users.get(sender, users_default)

            if user_power_level < EXPERT:
                logger.warning(f"Expert verification blocked: {sender} has power level {user_power_level} < {EXPERT} in room {room_id}")
                return "Only experts can send verification messages"

            logger.debug(f"Expert verification allowed: {sender} has power level {user_power_level} in room {room_id}")
            return False

        except Exception as e:
            logger.error(f"Error checking expert status for {sender} in room {room_id}: {e}")
            # Fail closed - block the message if we can't verify expert status
            return "Could not verify expert status"
