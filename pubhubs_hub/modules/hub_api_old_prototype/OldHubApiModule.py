from synapse.module_api import ModuleApi

from .OldHubStore import HubStore;
from .OldHubResource import HubResource
from synapse.logging.context import run_in_background

import logging

logger = logging.getLogger(__name__)

class HubApiModule:

	def __init__(self, hub_api_config: dict, module_api: ModuleApi):
		logger.info("Initializing HubApi module...")

		store = HubStore(module_api)

		run_in_background(store.create_tables)
		run_in_background(store.init_hub_info)

		module_api.register_web_resource("/_synapse/client/hub", HubResource(store, module_api))

