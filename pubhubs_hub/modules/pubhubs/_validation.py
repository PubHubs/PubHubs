"""Utility functions for request validation."""

import logging
import json
from typing import List
from functools import wraps
from typing import Callable

from synapse.http.server import respond_with_json
from synapse.http.site import SynapseRequest
from synapse.module_api import ModuleApi
from synapse.api.errors import SynapseError

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
    user_id: str,request: SynapseRequest, module_api: ModuleApi) -> bool:
    """
    Args:
        user_id
        module_api
    Returns:
        boolean: True if the user is an admin
    """

    if not await module_api.is_user_admin(user_id):
        raise PermissionError("Only Hub admins can access this resource")
    return True

def user_validator(require_admin: bool = False):
    """
    Decorater that handles user validation and error handling
    
    Raises:
        SynapseError if the iser assertion fails
        PermissionError if require_admin is true and the admin assertion fails

    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(self, request: SynapseRequest):
            user_id = None
            try:
                user_id = await assert_is_user(request, self._module_api)
                if require_admin:
                    await assert_is_admin(user_id, request, self._module_api)
                return await func(self, request, user_id)

            except TypeError as e:
                respond_with_json(request, 400, {"errors": f"{str(e)}"}, True)
            except json.JSONDecodeError:
                respond_with_json(request, 400, {"error": "Invalid JSON"})
            except SynapseError as e:
                respond_with_json(request, e.code, {"Synapse error": e.msg})
            except PermissionError as e:
                logger.info(f"User {user_id if user_id else 'unknown'} does not have permission.")
                message = "Only Hub admins can access this resource." if require_admin else "You need appropriate permissions to access this resource."
                respond_with_json(request, 403, {"message": message})
            except Exception as e:
                logger.exception("Unexpected error in endpoint")
                respond_with_json(request, 500, {"error": str(e)})
        return wrapper
    return decorator
