"""Utility functions for request validation."""

import logging
import json
from typing import Optional
from functools import wraps
from typing import Callable

from synapse.http.server import respond_with_json
from synapse.http.site import SynapseRequest
from synapse.module_api import ModuleApi
from synapse.api.errors import SynapseError
from synapse.api.constants import EventTypes

from ._constants import HUB_ADMIN, ROOM_ADMIN, USER, GUEST
from ._errors import HTTPError, BadRequestError, ForbiddenError, InsufficientPowerLevelError

logger = logging.getLogger("synapse.contrib." + __name__)


async def assert_is_user(
    request: SynapseRequest, module_api: ModuleApi
) -> str:
    """
    This check makes sure the request has a valid access token,
    and is a way to retrieve the user_id using only the Authorization header
    
    Raises:
        SynapseError if no valid access token is present in the Authorization header
    
    Args:
        request
        module_api

    Returns:
        str: user_id
    """
    user = await module_api.get_user_by_req(request)
    return str(user.user)

async def assert_is_admin(
    user_id: str, request: SynapseRequest, module_api: ModuleApi) -> bool:
    """
    Args:
        user_id
        module_api
    Returns:
        boolean: True if the user is an admin
    """

    if not await module_api.is_user_admin(user_id):
        raise ForbiddenError("Only Hub admins can access this resource.")
    return True


def get_room_id_from_request(request: SynapseRequest) -> Optional[str]:
    """Extract room_id from the request query parameters or body."""
    if isinstance(request, dict):  # Test case scenario where request is a dict
        room_id_bytes = request.get(b'room_id', [None])[0]
    else:  # Normal case where request has 'args' attribute
        room_id_bytes = request.args.get(b'room_id', [None])[0]

    if room_id_bytes:
        return room_id_bytes.decode('utf-8')

    return None


def get_user_power_level(user_id: str, power_levels_dict: dict) -> int:
    """Extract the user's power level from the power levels dictionary.

    Args:
        user_id: The user ID to look up
        power_levels_dict: The power levels content from the room state

    Returns:
        The user's power level, or 0 if not found
    """
    logger.info(f"Permission levels dict: {power_levels_dict}")
    users = power_levels_dict.get('users', {})
    logger.info(f"Users in dictionary: {users}")
    if user_id in users:
        return users[user_id]
    return 0


async def assert_has_power_level(
    request: SynapseRequest,
    user_id: str,
    module_api: ModuleApi,
    required_permissions_level: int,
    room_id: Optional[str] = None
) -> None:
    """Assert that a user has at least the required power level in a room.

    Args:
        request: The Synapse request
        user_id: The user ID to check
        module_api: The Synapse module API
        required_permissions_level: The minimum power level required
        room_id: Optional room ID. If not provided, extracted from request.

    Raises:
        InsufficientPowerLevelError: If the user lacks the required power level
    """
    if room_id is None:
        room_id = get_room_id_from_request(request)

    if not room_id:
        raise InsufficientPowerLevelError(user_id, required_permissions_level, 0, "unknown")

    room_event = await module_api.get_room_state(room_id, [(EventTypes.PowerLevels, "")])
    power_levels_event = room_event.get(('m.room.power_levels', ''))

    user_power_level = 0
    if power_levels_event:
        power_levels = power_levels_event.content
        user_power_level = get_user_power_level(user_id, power_levels)

    if user_power_level < required_permissions_level:
        raise InsufficientPowerLevelError(user_id, required_permissions_level, user_power_level, room_id)


def user_validator(required_permissions_level: int):
    """
    Decorator that handles user validation and error handling based on power levels.

    Args:
        required_permissions_level: The power level required to access this resource.

    Raises:
        SynapseError if the user assertion fails
        ForbiddenError if the power level/admin assertion fails

    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(self, request: SynapseRequest):
            user_id = None
            try:
                
                # Permission level == -1: No power level check or user assertion needed
                if required_permissions_level == GUEST:
                    return await func(self, request)

                user_id = await assert_is_user(request, self._module_api)
                # Permission level == 0: Just validate user
                if required_permissions_level == USER:
                    return await func(self, request, user_id)

                # Permission level == 999: Hub admin check
                if required_permissions_level == HUB_ADMIN:
                    await assert_is_admin(user_id, request, self._module_api)
                    return await func(self, request, user_id)

                # Check room power level, fall back to hub admin check if insufficient
                try:
                    await assert_has_power_level(request, user_id, self._module_api, required_permissions_level)
                except InsufficientPowerLevelError:
                    await assert_is_admin(user_id, request, self._module_api)
                return await func(self, request, user_id)

            except (TypeError, json.JSONDecodeError) as e:
                error = BadRequestError(str(e) if isinstance(e, TypeError) else "Invalid JSON")
                respond_with_json(request, error.status, error.to_response())
            except SynapseError as e:
                respond_with_json(request, e.code, {"Synapse error": e.msg})
            except HTTPError as e:
                logger.info(f"User {user_id or 'unknown'}: {e.message}")
                respond_with_json(request, e.status, e.to_response())
            except Exception as e:
                logger.exception("Unexpected error in endpoint")
                respond_with_json(request, 500, {"error": str(e)})
        return wrapper
    return decorator
