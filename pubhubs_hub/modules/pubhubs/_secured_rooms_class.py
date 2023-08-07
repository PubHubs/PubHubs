import enum
import json
from json import JSONEncoder
from typing import Optional
import logging
from synapse.api.constants import RoomCreationPreset, EventTypes
from synapse.handlers.room import RoomCreationHandler
from synapse.module_api import ModuleApi
from synapse.types import create_requester

from ._constants import ROOM_ID, DEFAULT_EXPIRATION_TIME_DAYS
import logging

logger = logging.getLogger(__name__)

class PubHubsSecuredRoomType(str, enum.Enum):
    MESSAGES = "ph.messages.restricted"
    THREADING = "ph.threading.restricted"


def is_list_of_strings(attributes):
    return isinstance(attributes, list) or not all(map(lambda x: isinstance(x, str), attributes))


class RoomAttribute:
    accepted_values: list[str]
    profile: bool

    def __init__(self, accepted_values=None, profile=None):
        if not isinstance(profile, bool):
            raise TypeError("'profile' should be a boolean")

        if not is_list_of_strings(accepted_values):
            raise TypeError("'accepted_values' should be a list of strings")

        self.profile = profile
        self.accepted_values = accepted_values


class RoomAttributeEncoder(JSONEncoder):

    def default(self, o):
        if isinstance(o, RoomAttribute):
            return {'profile': o.profile, 'accepted_values': o.accepted_values}
        else:
            return JSONEncoder.default(self, o)


class SecuredRoom:
    room_name: str

    accepted: dict[str, RoomAttribute]

    # Number of days but can also be in decimals e.g. half a day is 0.5
    # Useful for quick testing.
    expiration_time_days: float 
    
    # TODO translations :), but will see how/if this is used in practice
    user_txt: str

    type: PubHubsSecuredRoomType

    room_id: Optional[str]  # optional since when creating will be returned  Optional[str]

    def __init__(self, room_name=None, accepted=None,expiration_time_days=DEFAULT_EXPIRATION_TIME_DAYS, user_txt=None,  type=None,
                 room_id=None):
        errors = []

        if not isinstance(room_name, str):
            errors.append("'room_name' should be a string")

        accepted_error = "'accepted' should be an object with keys of attributes required to join the room, followed " \
                         "by an object with a list of accepted values and a boolean whether they need to show as " \
                         "profile information, or an empty list for all values allowed"

        if not isinstance(accepted, dict):
            errors.append(accepted_error)
        else:
            try:
                self.accepted = dict(map(lambda kv: (kv[0], RoomAttribute(**kv[1])), accepted.items()))
            except TypeError:
                errors.append(accepted_error)
   
        if not isinstance(user_txt, str):
            errors.append("'user_txt' should be a string")

        if not isinstance(float(expiration_time_days), float):
            errors.append("'expiration_time' should be a real number.")

        try:
            self.type = PubHubsSecuredRoomType(type)
        except ValueError:
            values = map(lambda x: x.value, PubHubsSecuredRoomType)
            errors.append(f"'type' should be one of: {', '.join(values)}")

        if room_id and not isinstance(room_id, str):
            errors.append("'room_id' should be a string or nothing")

        if len(errors) != 0:
            raise TypeError(". ".join(errors))

        self.room_name = room_name
        self.user_txt = user_txt
        self.room_id = room_id
        # Rationale: convert days to minutes to make it simpler for testing and production.
        # For example, a smaller number of days in decimals e.g., 0.001 can be given.
        self.expiration_time_days = expiration_time_days 

    async def matrix_create(self, module_api: ModuleApi, room_creation_handler: RoomCreationHandler, user,
                            server_notices_user):
        requester = create_requester(user)
        config = {
            "preset": RoomCreationPreset.PUBLIC_CHAT,
            "creation_content": {"type": f"{self.type.value}"},
            "name": f"{self.room_name}",
            "visibility": "public",
            # 100 for creator is by default, but we want some power for the server notices user to add profile attribute
            # events to the room.
            "power_level_content_override": {"users": {user: 100, server_notices_user: 50}}
        }
        [room_id, _room_alias, _int] = await room_creation_handler.create_room(requester, config)

        self.room_id = room_id


        # Add server notices user, creator is automatically a member
        await module_api.update_room_membership(server_notices_user, server_notices_user, self.room_id, 'join')

        # Add to public rooms list, so it can be found.
        await module_api.public_room_list_manager.add_room_to_public_room_list(self.room_id)

    async def update_name(self, name: str, module_api: ModuleApi, user: str):
        if self.room_name == name:
            return
        await module_api.create_and_send_event_into_room(
            {
                "content": {"name": name},
                "sender": user,
                "type": EventTypes.Name,
                "room_id": self.room_id,
                "state_key": "",
            })

    def to_dict(self):
        dict_to_return = self.__dict__
        # AttributeError: 'dict' object has no attribute '__dict__'
        dict_to_return['accepted'] = {k: v.__dict__ for k, v in self.accepted.items()} #self.accepted.__dict__
        return dict_to_return

