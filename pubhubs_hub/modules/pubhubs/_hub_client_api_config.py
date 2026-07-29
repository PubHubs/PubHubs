import logging
from synapse.module_api import ModuleApi
from synapse.module_api.errors import ConfigError
from ._constants import CLIENT_URL, GLOBAL_CLIENT_URL, DEV_URL, YIVI_URL, CLIENT_YIVI_URL, PUBLIC_YIVI_URL

logger = logging.getLogger("synapse.contrib." + __name__)

class HubClientApiConfig(object):
    _config: dict
    _module_api: ModuleApi
    _assets_dir_path: str
    _media_dir_path: str

    def __init__(self, config: dict, module_api: ModuleApi):
        self._config = config
        self._module_api = module_api
        # Data in assets directory should not be persistent, so we can update the contents without server admins needing to do anything.
        self._assets_dir_path = '/non-persistent-data/assets'
        # Data in media directory should be persistent, so user-uploaded media files are not lost when rebuilding the docker images.
        self._media_dir_path = '/data/media'

    @property
    def client_url(self) -> str:
        return self._config[CLIENT_URL]
    
    @property
    def global_client_url(self) -> str:
        return self._config[GLOBAL_CLIENT_URL]
    
    @property
    def allowed_origins(self) -> list:
        if isinstance(self._config.get(DEV_URL), str):
            return [self._config[CLIENT_URL], self._config[DEV_URL]]
        else:
            return [self._config[CLIENT_URL]]

    @property
    def yivi_url_web(self) -> str:
        return self._config.get(YIVI_URL, 'http://localhost:8089')

    @property
    def yivi_url_proxy(self) -> str:
        return self._config.get(CLIENT_YIVI_URL, 'http://localhost:8088')

    @property
    def public_yivi_url(self) -> str:
        return self._config.get(PUBLIC_YIVI_URL, self._module_api.public_baseurl)
    
    @property
    def server_notices_user(self) -> str:
        server_notices_user = self._module_api._hs.get_server_notices_manager().server_notices_mxid
        if not isinstance(server_notices_user, str):
            raise ConfigError("server_notices_user must be a string")
        return server_notices_user
    
    @property
    def hub_description_path(self) -> str:
        return f"{self._media_dir_path}/hub_settings"
    
    @property
    def hub_banner_path(self) -> str:
        return f"{self._media_dir_path}/hub_banner"
    
    @property
    def default_hub_description_path(self) -> str:
        return f"{self._assets_dir_path}/default_hub_settings.json"
    
    @property
    def default_hub_banner_path(self) -> str:
        return f"{self._assets_dir_path}/default_hub_banner.png"

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


