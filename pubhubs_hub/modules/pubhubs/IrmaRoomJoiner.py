import logging
from urllib.parse import urlparse

from typing import Tuple

from synapse.events import EventBase
from synapse.handlers.room import RoomCreationHandler, RoomShutdownHandler
from synapse.logging.context import run_in_background
from synapse.module_api import ModuleApi
from synapse.module_api.errors import ConfigError
from synapse.types import create_requester
from synapse.api.constants import RoomCreationPreset

from ._irma_proxy import ProxyServlet
from ._secured_rooms_class import SecuredRoom
from ._secured_rooms_web import SecuredRoomsServlet
from ._store import IrmaRoomJoinStore
from ._web import JoinServlet
from ._constants import CLIENT_URL, SERVER_NOTICES_USER, ROOM_ID

logger = logging.getLogger("synapse.contrib." + __name__)

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
        secured_room = await self.store.get_secured_room(room)
        if secured_room:
            return await self.store.is_allowed(user, room)

        # Fallthrough other rooms which are not set to have to reveal anything
        return True

    def __init__(self, config: dict, api: ModuleApi, store=None):
        self.config = config

        # Assert the server notices user exists, we have to make this mandatory
        server_notices_user = api._hs.get_server_notices_manager().server_notices_mxid
        assert isinstance(server_notices_user, str)

        self.config[SERVER_NOTICES_USER] = server_notices_user
        if store:
            self.store = store
        else:
            self.store = IrmaRoomJoinStore(api)
        self.module_api = api
        # We need the private fields for account data to set widgets
        self.room_creation_handler = RoomCreationHandler(api._hs)
        self.room_shutdown_handler = RoomShutdownHandler(api._hs)

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

        api.register_web_resource("/_synapse/client/secured_rooms", SecuredRoomsServlet( self.config,self.store,
                                                                                               self.module_api,self.room_creation_handler,self.room_shutdown_handler, self.config[SERVER_NOTICES_USER]))

        api.register_spam_checker_callbacks(user_may_join_room=self.joining)

    @staticmethod
    def parse_config(config: dict) -> dict:
        logger.debug(f"Getting the config: '{config}'")
        if config.get(CLIENT_URL) is None or not isinstance(
                config.get(CLIENT_URL), str):
            raise ConfigError(
                f"'{CLIENT_URL}' should be a string in the config")

        return config
