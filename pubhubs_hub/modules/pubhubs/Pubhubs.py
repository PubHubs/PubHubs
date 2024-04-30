import logging
from synapse.module_api import ModuleApi

class Pubhubs(object):
  """
  General synapse module for that is needed for the proper and secure funtioning of Pubhubs.
  """

  def __init__(self, config: dict, api: ModuleApi) -> None:
    """
    Args:
        config: The parsed config field from the synapse configuration file (homeserver.yaml) for this module
        api: Synapse module api to talk to the synapse
    """

    self.config = config
    self.api = api
    self.logger = logging.getLogger("synapse.contrib." + __name__)

    self.api.register_third_party_rules_callbacks(on_create_room=self.on_create_room)


  async def on_create_room(
    self,
    requester: "synapse.types.Requester",
    request_content: dict,
    is_requester_admin: bool,
  ) -> None:
    self.logger.info(f"running on_create_room callback: {requester}, {request_content}, {is_requester_admin}")
