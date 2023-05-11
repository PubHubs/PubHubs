import logging

import synapse
from synapse.handlers.room import RoomCreationHandler, RoomShutdownHandler
from synapse.http.server import set_clickjacking_protection_headers
from synapse.logging.context import run_in_background
from synapse.module_api import ModuleApi
from synapse.module_api.errors import ConfigError
from twisted.web.server import Request

from ._yivi_proxy import ProxyServlet
from ._secured_rooms_web import SecuredRoomsServlet
from ._store import YiviRoomJoinStore
from ._web import JoinServlet
from ._constants import CLIENT_URL, SERVER_NOTICES_USER, GLOBAL_CLIENT_URL

logger = logging.getLogger("synapse.contrib." + __name__)


def modify_set_clickjacking_protection_headers(original, global_client_url: str):
    """
    This function returns a changed form of `synapse.http.server.set_clickjacking_protection_headers`.
    This allows embedding the page asking the user to agree to the hub's terms and conditions.
    It is a bit hacky. And we hope it will become configurable in Synapse.

    Args:
        original: The original clickjacking protection function.
        global_client_url: The global client url the terms and conditions can be allowed in.
    """
    def modified(request: Request):
        original(request)
        if request.path in (b'/_synapse/client/new_user_consent', b'/_synapse/client/oidc/callback'):
            request.responseHeaders.removeHeader(b"X-Frame-Options")
            request.setHeader(b"Content-Security-Policy", f"frame-ancestors {global_client_url};".encode())
    return modified


class YiviRoomJoiner(object):
    """Main class that has the methods to create waiting rooms with widgets that serve an Yivi QR that allows users to
    join secured rooms based on certain attributes. It's used as a synapse module.
    """

    async def joining(self, user: str, room: str, invited: bool) -> bool:
        """The hook for:
        https://matrix-org.github.io/synapse/v1.48/modules/spam_checker_callbacks.html#user_may_join_room
        Will check if user is allowed to join the room (correct attributes revealed through Yivi) if not will create the
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

        synapse.http.server.set_clickjacking_protection_headers = modify_set_clickjacking_protection_headers(synapse.http.server.set_clickjacking_protection_headers,config.get(GLOBAL_CLIENT_URL))

        self.config = config

        # Assert the server notices user exists, we have to make this mandatory
        server_notices_user = api._hs.get_server_notices_manager().server_notices_mxid
        assert isinstance(server_notices_user, str)

        self.config[SERVER_NOTICES_USER] = server_notices_user
        if store:
            self.store = store
        else:
            self.store = YiviRoomJoinStore(api)
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
            "/_synapse/client/yiviproxy",
            ProxyServlet(
                self.config,
                self.module_api))

        api.register_web_resource("/_synapse/client/secured_rooms", SecuredRoomsServlet(self.config, self.store,
                                                                                        self.module_api,
                                                                                        self.room_creation_handler,
                                                                                        self.room_shutdown_handler,
                                                                                        self.config[
                                                                                            SERVER_NOTICES_USER]))

        api.register_spam_checker_callbacks(user_may_join_room=self.joining)

    @staticmethod
    def parse_config(config: dict) -> dict:
        logger.debug(f"Getting the config: '{config}'")
        if config.get(CLIENT_URL) is None or not isinstance(
                config.get(CLIENT_URL), str):
            raise ConfigError(
                f"'{CLIENT_URL}' should be a string in the config")

        if config.get(GLOBAL_CLIENT_URL) is None or not isinstance(
                config.get(GLOBAL_CLIENT_URL), str):
            raise ConfigError(
                f"'{GLOBAL_CLIENT_URL}' should be a string in the config")

        return config
