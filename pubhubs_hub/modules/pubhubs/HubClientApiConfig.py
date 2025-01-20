import logging
from synapse.module_api.errors import ConfigError
from ._constants import CLIENT_URL, GLOBAL_CLIENT_URL

logger = logging.getLogger("synapse.contrib." + __name__)

class HubClientApiConfig(object):
    _hub_client_url: str
    _global_client_url: str
    _assets_dir_path: str
    _media_dir_path: str

    def __init__(self, module_config_from_file: dict):
        self.init_module_config_from_file(module_config_from_file)

        # Data in assets directory should not be persistent, so we can update the contents without server admins needing to do anything.
        self._assets_dir_path = '/non-persistent-data/assets'

        # Data in media directory should be persistent, so user-uploaded media files are not lost when rebuilding the docker images.
        self._media_dir_path = '/data/media'

    @property
    def hub_client_url(self) -> str:
        return self._hub_client_url

    @property
    def global_client_url(self) -> str:
        return self._global_client_url

    @property
    def hub_icon_path(self) -> str:
        return f"{self._media_dir_path}/hub_icon"

    @property
    def hub_icon_dark_path(self) -> str:
        return f"{self._media_dir_path}/hub_icon_dark"

    @property
    def default_hub_icon_path(self) -> str:
        return f"{self._assets_dir_path}/default_hub_icon.png"

    @property
    def default_hub_icon_dark_path(self) -> str:
        return f"{self._assets_dir_path}/default_hub_icon_dark.png"

    @property
    def media_dir_path(self) -> str:
        return self._media_dir_path

    def init_module_config_from_file(self, module_config_from_file: dict) -> dict:
        logger.debug(f"Initializing module config from synapse configuration file: '{module_config_from_file}'")

        if module_config_from_file.get(CLIENT_URL) is None or not isinstance(module_config_from_file.get(CLIENT_URL), str):
            raise ConfigError(f"'{CLIENT_URL}' should be a string in the config")
        self._hub_client_url = module_config_from_file.get(CLIENT_URL)

        if module_config_from_file.get(GLOBAL_CLIENT_URL) is None or not isinstance(module_config_from_file.get(GLOBAL_CLIENT_URL), str):
            raise ConfigError(f"'{GLOBAL_CLIENT_URL}' should be a string in the config")
        self._global_client_url = module_config_from_file.get(GLOBAL_CLIENT_URL)

