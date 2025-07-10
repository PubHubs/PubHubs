import logging
import os
import synapse
from synapse.logging.context import run_in_background
from synapse.module_api import ModuleApi
from synapse.module_api.errors import ConfigError
from twisted.web.server import Request

from ._yivi_proxy import ProxyServlet
from ._secured_rooms_web import SecuredRoomsServlet, NoticesServlet, SecuredRoomExtraServlet
from ._store import HubStore
from ._web import JoinServlet
from ._constants import CLIENT_URL, SERVER_NOTICES_USER, GLOBAL_CLIENT_URL, METHOD_POLLING_INTERVAL
from .HubResource import HubResource
from .HubClientApiConfig import HubClientApiConfig


logger = logging.getLogger("synapse.contrib." + __name__)


# TODO: move this to some more general spot
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
        if request.path in (
            b"/_synapse/client/new_user_consent",
            b"/_synapse/client/oidc/callback",
            b"/_synapse/client/sso_register",
        ):
            request.responseHeaders.removeHeader(b"X-Frame-Options")
            request.setHeader(b"Content-Security-Policy", f"frame-ancestors {global_client_url};".encode())

    return modified


def modify_set_cors_headers(original):
    """
    This function returns a changed form of `synapse.http.server.set_cors_headers`.
    This allows the Yivi SSE endpoint to be proxied since it asks for the "Cache-Control" header to be allowed.
    For this endpoint it's fine to allow this.
    It is a bit hacky. And we hope it will become configurable in Synapse.

    Args:
        original: The original allowed cors header function.
    """

    def modified(request: Request):
        original(request)
        if request.path.endswith(b"/frontend/statusevents"):
            request.setHeader(
                b"Access-Control-Allow-Headers",
                b"X-Requested-With, Content-Type, Authorization, Date, Cache-Control",
            )

    return modified

class HubClientApi(object):
    """
    This module is meant to handle requests from the hub client that are specific to PubHubs (so not supported by Synapse).

    Synapse lets modules add api endpoints by registering 'resources' which implement Twisted's IResource interface.

    Configuration that can differ per Hub can be configured in the main synapse config file under the module specific configuration.
    This configuration is parsed and wrapped by the HubClientApiConfig which also provides configuration that is the same for all Hubs.
    """

    _module_config: HubClientApiConfig
    _is_test: bool

    def __init__(self, config: dict, api: ModuleApi, store=None, is_test=False):
        """
        Args:
            config: The configuration for this module.
            isTest: If true, we are running in a test environment and do some hacks to make it work.
        """

        synapse.http.server.set_clickjacking_protection_headers = modify_set_clickjacking_protection_headers(
            synapse.http.server.set_clickjacking_protection_headers, config.get(GLOBAL_CLIENT_URL)
        )
        synapse.http.server.set_cors_headers = modify_set_cors_headers(synapse.http.server.set_cors_headers)

        # Deprecated: use HubClientApiConfig class instead
        self.config = config

        self._module_config = HubClientApiConfig(config)
        self._is_test = is_test
        self._create_media_dir(self._module_config.media_dir_path)

        # Assert the server notices user exists, we have to make this mandatory
        server_notices_user = api._hs.get_server_notices_manager().server_notices_mxid

        assert isinstance(server_notices_user, str)

        self.config[SERVER_NOTICES_USER] = server_notices_user
        if store:
            self.store = store
        else:
            self.store = HubStore(api, config)
            # self.store = YiviRoomJoinStore(api)
        self.module_api = api
        # We need the private fields for account data to set widgets
        self.room_creation_handler = synapse.handlers.room.RoomCreationHandler(api._hs)
        self.room_shutdown_handler = synapse.handlers.room.RoomShutdownHandler(api._hs)

        run_in_background(self.store.create_tables)

        self.module_api.looping_background_call(self.store.remove_from_room, METHOD_POLLING_INTERVAL)

        api.register_web_resource("/_synapse/client/ph", JoinServlet(self.config, self.module_api, self.store))
        api.register_web_resource("/_synapse/client/yiviproxy", ProxyServlet(self.config, self.module_api))

        api.register_web_resource(
            "/_synapse/client/secured_rooms",
            SecuredRoomsServlet(
                self.config,
                self.store,
                self.module_api,
                self.room_creation_handler,
                self.room_shutdown_handler,
                self.config[SERVER_NOTICES_USER],
            ),
        )

        api.register_web_resource("/_synapse/client/notices", NoticesServlet(self.config[SERVER_NOTICES_USER]))

        api.register_web_resource("/_synapse/client/srextra", SecuredRoomExtraServlet(self.store, self.module_api))

        api.register_web_resource("/_synapse/client/hub", HubResource(api, self._module_config, self.store))
        
        api.register_spam_checker_callbacks(user_may_join_room=self.joining)


    async def joining(self, user: str, room: str, invited: bool) -> bool:
        """The hook for:
        https://matrix-org.github.io/synapse/v1.48/modules/spam_checker_callbacks.html#user_may_join_room
        Will check if user is allowed to join the room (correct attributes revealed through Yivi) if not will create the
        waiting room if it doesn't exist or refresh the waiting room token if it's expired.
        """
        logger.debug(
            f"hi I am the joining method user is '{user}' and I want to join '{room}' config is '{self.config}'"
        )

        secured_room = await self.store.get_secured_room(room)
        if secured_room:
            return await self.store.is_allowed(user, room)

        # Fallthrough other rooms which are not set to have to reveal anything
        return True

    def _create_media_dir(self, media_dir_path: str) -> str:
        # A hack to make the tests work. We don't test anything that requires media_dir_path to exist at the moment.
        if self._is_test:
            return media_dir_path

        try:
            if not os.path.exists(media_dir_path):
                os.mkdir(media_dir_path)
                os.chmod(media_dir_path, 0o770)
                logger.info(f"Created media directory: '{media_dir_path}'")
        except Exception as e:
                logger.error(f"Failed to create media directory '{media_dir_path}': {e}")
            
        return media_dir_path

    # Deprecated: use HubClientApiConfig class instead
    @staticmethod
    def parse_config(config: dict) -> dict:
        logger.debug(f"Getting the config: '{config}'")
        if config.get(CLIENT_URL) is None or not isinstance(config.get(CLIENT_URL), str):
            raise ConfigError(f"'{CLIENT_URL}' should be a string in the config")

        if config.get(GLOBAL_CLIENT_URL) is None or not isinstance(config.get(GLOBAL_CLIENT_URL), str):
            raise ConfigError(f"'{GLOBAL_CLIENT_URL}' should be a string in the config")

        return config
