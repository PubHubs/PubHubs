import logging
from urllib.parse import urlparse

from typing import Tuple

from synapse.events import EventBase
from synapse.handlers.room import RoomCreationHandler
from synapse.logging.context import run_in_background
from synapse.module_api import ModuleApi
from synapse.module_api.errors import ConfigError
from synapse.types import create_requester
from synapse.api.constants import RoomCreationPreset

from ._irma_proxy import ProxyServlet
from ._store import IrmaRoomJoinStore
from ._web import JoinServlet
from ._constants import SECURED_ROOMS, ATTRIBUTES, ID, ACCEPTED, SERVER_NOTICES_USER, USER_TXT, \
    DEFAULT_INVITE, ROOM_ID, CLIENT_URL

logger = logging.getLogger("synapse.contrib." + __name__)


def _is_not_valid_url(param: str):
    try:
        parsed = urlparse(param)
        return parsed is None
    except ValueError:
        return True


class IrmaRoomJoiner(object):
    """Main class that has the methods to create waiting rooms with widgets that serve an IRMA QR that allows users to
    join secured rooms based on certain attributes. It's used as a synapse module.
    """
    async def joining(self, user: str, room: str, invited: bool) -> bool:
        """The hook for:
        https://matrix-org.github.io/synapse/v1.48/modules/spam_checker_callbacks.html#user_may_join_room
        Will check if user is allowed to join the room (correct attributes revealed through IRMA) if not will create the
        waiting room if it doesn't exist or refresh the waiting room token if it's expired.
        """
        logger.debug(
            f"hi I am the joining method user is '{user}' and I want to join '{room}' config is '{self.config}'")
        if room in map(lambda x: x[ID], self.config[SECURED_ROOMS]):
            # If allowed let the user in.
            lets_see = await self.store.is_allowed(user, room)
            logger.debug(
                f"lets see with '{user}' and  '{room}' answer was {lets_see}")
            if lets_see:
                return True
            server_notices_user = self.config[SERVER_NOTICES_USER]

            result = await self.store.valid_waiting_room(user, room)

            if result:
                (room_id, _) = result
                # Make user rejoin room in case the room was left
                await self.module_api.update_room_membership(server_notices_user, user, room_id, 'invite')
                # Add user to room (if not member); accept the invite. Other user cannot force another user to join
                await self.module_api.update_room_membership(user, user, room_id, 'join')
                return False
            else:
                result = await self.store.expired_token_waiting_room(user, room)
                if result:
                    token = await self.store.refresh_token(result[1])
                    room_id = result[0]
                else:
                    room_id, token = await self._create_waiting_room(server_notices_user, room, user)
            # Send correct widget to room either because token was expired or room didn't exist.
            await self.send_msg_with_link_to_join(server_notices_user, room, room_id, user, token)
            return False

        # Fallthrough other rooms which are not set to have to reveal anything
        return True

    async def send_msg_with_link_to_join(self, server_notices_user: str, room: str, room_id: str, user: str,
                                         token: str):
        url = f"{self.module_api.public_baseurl}_synapse/client/ph/start?access_token={token}&room_id={room}"

        # Create the widget
        event: EventBase = await self.module_api.create_and_send_event_into_room({
            'type': 'im.vector.modular.widgets',
            # Now im.vector.modular.widgets but will one day be m.widget
            # see https://github.com/vector-im/element-web/issues/13111 this might be a problem if we support more clients
            'room_id': room_id,
            'sender': server_notices_user,
            'state_key': 'this_is_the_widget_state_in_a_waiting_room',
            'content': {
                'creatorUserId': server_notices_user,
                'type': 'm.custom',
                'url': url
            }
        })

        event_id = event.event_id

        logger.debug(f"Widget creation {event_id=}")

        # Set widget as enabled for server_notices_user in the waiting room.
        await self.module_api.create_and_send_event_into_room({
            'type': 'io.element.widgets.layout',
            'room_id': room_id,
            'sender': server_notices_user,
            'state_key': '',
            'content': {
                "widgets": {
                    "this_is_the_widget_state_in_a_waiting_room":
                        {
                            "container": "top",
                            "height": 100,
                            "width": 100,
                            "index": 0}
                }
            }
        })

        # Private parameter but easiest way to do it.
        account_manager = self.module_api._hs.get_account_data_handler()
        # Set widget enabled for the real user in the waiting room.
        await account_manager.add_account_data_to_room(user, room_id, 'im.vector.setting.allowed_widgets', {
            f'{event_id}': True
        })

    async def invite_to_all(self, user: str):
        """The hook for
        https://matrix-org.github.io/synapse/v1.48/modules/account_validity_callbacks.html#on_user_registration

        Will create waiting rooms for a new user where the 'default_invite' setting for the secured room is set to true.
        """
        server_notices_user = self.config[SERVER_NOTICES_USER]
        for room in self.config[SECURED_ROOMS]:
            if not room.get(DEFAULT_INVITE, False):
                continue
            room = room[ID]
            room_id, token = await self._create_waiting_room(server_notices_user, room, user)
            await self.send_msg_with_link_to_join(server_notices_user, room, room_id, user, token)

    async def _create_waiting_room(self, server_notices_user: str, room: str, user: str) -> Tuple[str, str]:
        name = await self.store.get_room_name(room)
        requester = create_requester(server_notices_user)
        # Create waiting room where the real user is not allowed to send messages
        config = {
            "preset": RoomCreationPreset.PRIVATE_CHAT,
            "power_level_content_override": {"users_default": -10},
            "name": f"Persoonlijke wachtkamer voor: {name}"
        }
        [room_dict, _int] = await self.room_creation_handler.create_room(requester, config)
        room_id = room_dict[ROOM_ID]
        logger.debug(f"Created new room '{room_id}'")
        # Send invite to user
        await self.module_api.update_room_membership(server_notices_user, user, room_id, 'invite')
        # Add user to room (if not member); accept the invite. Other user cannot force another user to join
        await self.module_api.update_room_membership(user, user, room_id, 'join')

        # Register waiting room
        token = await self.store.wants_to_join(user, room, room_id)

        return room_id, token

    def __init__(self, config: dict, api: ModuleApi):
        self.config = config

        # Assert the server notices user exists, we have to make this mandatory
        server_notices_user = api._hs.get_server_notices_manager().server_notices_mxid
        assert isinstance(server_notices_user, str)

        self.config[SERVER_NOTICES_USER] = server_notices_user
        self.store = IrmaRoomJoinStore(api)
        self.module_api = api
        # We need the private fields for account data to set widgets
        self.room_creation_handler = RoomCreationHandler(api._hs)

        run_in_background(self.store.create_tables)

        api.register_web_resource(
            "/_synapse/client/ph",
            JoinServlet(
                self.config,
                self.module_api,
                self.store,
                self))
        api.register_web_resource(
            "/_synapse/client/irmaproxy",
            ProxyServlet(
                self.config,
                self.module_api))
        api.register_spam_checker_callbacks(user_may_join_room=self.joining)
        api.register_account_validity_callbacks(
            on_user_registration=self.invite_to_all)

    @staticmethod
    def parse_config(config: dict) -> dict:
        logger.debug(f"Getting the config: '{config}'")
        if config.get(SECURED_ROOMS) is None or not isinstance(
                config.get(SECURED_ROOMS), list):
            raise ConfigError(
                f"'{SECURED_ROOMS}' not present in configuration or is not a list")
        if config.get(CLIENT_URL) is None or not isinstance(
                config.get(CLIENT_URL), str):
            raise ConfigError(
                f"'{CLIENT_URL}' should be a string in the config")

        # Know it's not none
        rooms = config.get(SECURED_ROOMS)

        for room in rooms:
            if not isinstance(room, dict):
                raise ConfigError(
                    "each secured room should be represented as an object in the config")
            if room.get(ID) is None or not isinstance(room.get(ID), str):
                raise ConfigError(
                    f"'{ID}' should be supplied as a string for each room in the config")
            if room.get(ATTRIBUTES) is None or not isinstance(
                    room.get(ATTRIBUTES), list):
                raise ConfigError(
                    f"'{ATTRIBUTES}' should be supplied as a list for room '{room.get(ID)}'")
            if room.get(ACCEPTED) is None or not isinstance(
                    room.get(ACCEPTED), list):
                raise ConfigError(
                    f"'{ACCEPTED}' should be supplied for room '{room.get(ID)}'")
            if room.get(USER_TXT) is None or not isinstance(
                    room.get(USER_TXT), str):
                raise ConfigError(
                    f"'{USER_TXT}' should be a string for room '{room.get(ID)}'")

            accepted = room.get(ACCEPTED)

            for requirement in accepted:
                if not isinstance(requirement, dict):
                    raise ConfigError(
                        f"'{ACCEPTED}' should be a dictionary for room '{room.get(ID)}'")
                for attribute, values in requirement.items():
                    if attribute not in room.get(ATTRIBUTES):
                        raise ConfigError(
                            f"'{attribute}' is in the accepted list but not present in attributes of "
                            f"room '{room.get('id')}'")
                    if not isinstance(values, list) or not all(
                            isinstance(n, str) for n in values):
                        raise ConfigError(
                            f"accepted values for '{attribute}' should be a list of strings for room "
                            f"'{room.get('id')}'")

        return config
