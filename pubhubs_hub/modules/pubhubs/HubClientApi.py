import logging
import os

import synapse
from synapse.logging.context import run_in_background
from synapse.module_api import ModuleApi
from synapse.module_api.errors import ConfigError

from ._yivi_proxy import ProxyServlet
from ._video_call_web import VideoCallServlet
from ._secured_rooms_web import SecuredRoomsServlet, NoticesServlet, SecuredRoomPublicMetadataServlet
from ._store import HubStore
from ._web import JoinServlet
from ._spam_checker import SpamChecker
from ._cors import modify_set_clickjacking_protection_headers, modify_set_cors_headers
from ._constants import METHOD_POLLING_INTERVAL, CLIENT_URL, GLOBAL_CLIENT_URL
from ._hub_resource import HubResource
from ._hub_client_api_config import HubClientApiConfig
from ._steward import StewardResource


logger = logging.getLogger("synapse.contrib." + __name__)


class HubClientApi(object):
    """
    This module is meant to handle requests from the hub client that are specific to PubHubs (so not supported by Synapse).

    Synapse lets modules add api endpoints by registering 'resources' which implement Twisted's IResource interface.

    Configuration that can differ per Hub can be configured in the main synapse config file under the module specific configuration.
    This configuration is parsed and wrapped by the HubClientApiConfig which also provides configuration that is the same for all Hubs.
    """

    _config: HubClientApiConfig
    _is_test: bool

    def __init__(self, config: dict, api: ModuleApi, store=None, is_test=False):
        """
        Args:
            config: The configuration for this module.
            isTest: If true, we are running in a test environment and do some hacks to make it work.
        """
        self._config = HubClientApiConfig(config, api)

        synapse.http.server.set_clickjacking_protection_headers = modify_set_clickjacking_protection_headers(
            synapse.http.server.set_clickjacking_protection_headers, self._config.global_client_url
        )
        synapse.http.server.set_cors_headers = modify_set_cors_headers(synapse.http.server.set_cors_headers)

        self._is_test = is_test
        self._create_media_dir(self._config.media_dir_path)

        if store:
            self.store = store
        else:
            self.store = HubStore(api, self._config)
            # self.store = YiviRoomJoinStore(api)
        self.module_api = api
        # We need the private fields for account data to set widgets
        self.room_creation_handler = synapse.handlers.room.RoomCreationHandler(api._hs)
        self.room_shutdown_handler = synapse.handlers.room.RoomShutdownHandler(api._hs)

        run_in_background(self.store.create_tables)

        self.module_api.looping_background_call(self.store.remove_from_room, METHOD_POLLING_INTERVAL)

        api.register_web_resource("/_synapse/client/ph", JoinServlet(self._config, self.module_api, self.store))
        api.register_web_resource("/_synapse/client/yiviproxy", ProxyServlet(self._config, self.module_api))

        api.register_web_resource(
            "/_synapse/client/secured_rooms",
            SecuredRoomsServlet(
                self._config,
                self.store,
                self.module_api,
                self.room_creation_handler,
                self.room_shutdown_handler,
            ),
        )

        api.register_web_resource("/_synapse/client/notices", NoticesServlet(self._config.server_notices_user))

        api.register_web_resource(
            "/_synapse/client/secured_room/public_metadata",
            SecuredRoomPublicMetadataServlet(self.store, self.module_api),
        )

        api.register_web_resource("/_synapse/client/hub", HubResource(api, self._config, self.store))

        api.register_web_resource("/_synapse/client/videocall", VideoCallServlet( self._config,  self.store, self.module_api))

        api.register_web_resource("/_synapse/client/steward", StewardResource(api, self._config, self.store))

        self.spam_checker = SpamChecker(api, self.store)
        api.register_spam_checker_callbacks(
            user_may_join_room=self.spam_checker.user_may_join_room,
            check_event_for_spam=self.spam_checker.check_event_for_spam,
        )

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

    @staticmethod
    def parse_config(config: dict) -> dict:
        logger.debug(f"Initializing module config from synapse configuration file: '{config}'")

        if config.get(CLIENT_URL) is None or not isinstance(config.get(CLIENT_URL), str):
            raise ConfigError(f"'{CLIENT_URL}' should be a string in the config")

        if config.get(GLOBAL_CLIENT_URL) is None or not isinstance(config.get(GLOBAL_CLIENT_URL), str):
            raise ConfigError(f"'{GLOBAL_CLIENT_URL}' should be a string in the config")

        return config
