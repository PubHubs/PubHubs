"""Parent resource for steward-related endpoints."""

import logging

from synapse.http.server import DirectServeJsonResource
from synapse.module_api import ModuleApi

from ..HubClientApiConfig import HubClientApiConfig
from .._store import HubStore
from ._reports import StewardReportsServlet
from ._secured_rooms import StewardSecuredRoomsServlet

logger = logging.getLogger("synapse.contrib." + __name__)


class StewardResource(DirectServeJsonResource):
    """Parent resource for steward endpoints.

    Organizes steward-related endpoints under /_synapse/client/steward/
    """

    def __init__(
        self,
        module_api: ModuleApi,
        config: HubClientApiConfig,
        store: HubStore,
    ):
        super().__init__()

        self._module_api = module_api
        self._config = config
        self._store = store

        self.putChild(b"reports", StewardReportsServlet(module_api, config, store))
        self.putChild(b"secured_rooms", StewardSecuredRoomsServlet(module_api, config, store))
