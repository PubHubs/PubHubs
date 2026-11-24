import logging
from typing import Union

from synapse.api.constants import EventTypes
from synapse.module_api import ModuleApi

from ._constants import EXPERT_VERIFICATION_MSGTYPE, EXPERT, STEWARD, ROOM_ADMIN
from ._store import HubStore
from ._validation import get_user_power_level

logger = logging.getLogger("synapse.contrib." + __name__)


class SpamChecker:
    """
    Spam checker callbacks for PubHubs-specific validation.

    Registered callbacks:
    - user_may_join_room: Controls access to secured rooms
    - check_event_for_spam: Validates expert verification messages and power level changes
    """

    def __init__(self, module_api: ModuleApi, store: HubStore):
        self.module_api = module_api
        self.store = store
        # Joins let through regardless of attributes, see allow_join
        self._allowed_joins: set[tuple[str, str]] = set()

    def allow_join(self, user: str, room: str) -> None:
        """
        Lets user join room even when it is secured and they don't have the attributes, until revoke_join.
        For a room takeover, where a former admin rejoins only to hand over their power.
        """
        self._allowed_joins.add((user, room))

    def revoke_join(self, user: str, room: str) -> None:
        self._allowed_joins.discard((user, room))

    async def user_may_join_room(self, user: str, room: str, invited: bool) -> bool:
        """
        Spam checker callback for user_may_join_room.

        Will check if user is allowed to join the room (correct attributes revealed through Yivi).

        See: https://matrix-org.github.io/synapse/v1.48/modules/spam_checker_callbacks.html#user_may_join_room
        """
        logger.debug(f"user_may_join_room: user='{user}' room='{room}' invited={invited}")

        if (user, room) in self._allowed_joins:
            return True

        secured_room = await self.store.get_secured_room(room)
        if secured_room:
            return await self.store.is_allowed(user, room)

        # Fallthrough: allow joining rooms that don't require attribute disclosure
        return True

    async def check_event_for_spam(self, event) -> Union[str, bool]:
        """
        Spam checker callback, dispatching to the PubHubs-specific checks below.
        """
        if event.type == EventTypes.PowerLevels:
            return await self._check_power_levels_change(event)
        return await self._check_expert_verification(event)

    async def _check_power_levels_change(self, event) -> Union[str, bool]:
        """
        Restricts what non-room-admins may change in m.room.power_levels.

        Matrix has a single power level for sending m.room.power_levels, and it has to stay at steward
        level so stewards can appoint experts and other stewards. On its own Matrix would then also let a
        steward change any other setting up to their own level. So below room admin only `users` may
        change, and only when both the old and new level are at most steward: stewards can promote users
        to expert or steward and demote experts.

        Returns:
            - False to allow the event
            - A string error message to block the event
        """
        room_id = event.room_id
        sender = event.sender

        try:
            state = await self.module_api.get_room_state(room_id, [(EventTypes.PowerLevels, "")])
            power_levels_event = state.get((EventTypes.PowerLevels, ""))

            # Initial power levels while the room is being created: nothing to compare against.
            if power_levels_event is None:
                return False

            old_content = power_levels_event.content
            new_content = event.content
            # Room creators of v12+ rooms would come out at users_default and be blocked below, see get_user_power_level
            sender_power_level = get_user_power_level(sender, old_content)
            if sender_power_level >= ROOM_ADMIN:
                return False

            old_settings = {key: value for key, value in old_content.items() if key != "users"}
            new_settings = {key: value for key, value in new_content.items() if key != "users"}
            if old_settings != new_settings:
                logger.warning(f"Power levels change blocked: {sender} changed settings other than users in room {room_id}")
                return "Only room admins can change power level settings"

            if sender_power_level < STEWARD:
                return "Not allowed to change power levels"

            for user_id in set(old_content.get("users", {})) | set(new_content.get("users", {})):
                old_level = get_user_power_level(user_id, old_content)
                new_level = get_user_power_level(user_id, new_content)
                if old_level != new_level and max(old_level, new_level) > STEWARD:
                    logger.warning(
                        f"Power levels change blocked: {sender} ({sender_power_level}) tried to change {user_id} from {old_level} to {new_level} in room {room_id}"
                    )
                    return "Not allowed to change this user's power level"

            return False

        except Exception as e:
            logger.error(f"Error checking power levels change by {sender} in room {room_id}: {e}")
            # Fail closed - block the change if we can't verify it
            return "Could not verify power levels change"

    async def _check_expert_verification(self, event) -> Union[str, bool]:
        """
        Enforces that only experts can send expert verification messages.
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

            user_power_level = get_user_power_level(sender, power_levels_event.content)

            if user_power_level < EXPERT:
                logger.warning(f"Expert verification blocked: {sender} has power level {user_power_level} < {EXPERT} in room {room_id}")
                return "Only experts can send verification messages"

            logger.debug(f"Expert verification allowed: {sender} has power level {user_power_level} in room {room_id}")
            return False

        except Exception as e:
            logger.error(f"Error checking expert status for {sender} in room {room_id}: {e}")
            # Fail closed - block the message if we can't verify expert status
            return "Could not verify expert status"
