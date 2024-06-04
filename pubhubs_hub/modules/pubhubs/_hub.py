from synapse.module_api import ModuleApi
from synapse.http.server import DirectServeJsonResource,respond_with_json
from synapse.http.site import SynapseRequest
from synapse.http.servlet import parse_json_object_from_request
import logging

logger = logging.getLogger(__name__)

class HubJoiner(DirectServeJsonResource):
    """
     This class is used to check whether user joins the hub for first time or not.
    for example checking whether the user has joined the hub for the firt time or not.
    """
    def __init__(self, store: str, module_api: ModuleApi) -> None:
        super().__init__()
        # self.config = config
        self.store = store
        self.module_api = module_api
  
    async def _async_render_POST(self, request: SynapseRequest):
        """Returns a response containing a Boolean value indicating whether user has joined hub or not
           Useful for identifying whether user has joined hub for first time or not.
           response is False if this is first time join otherwise True indicating user has already joined hub.
        """
        request_body = parse_json_object_from_request(request)        
        # If user Id is not present in the PH store yet. This only happens when we join the room for the first time.
        # After the user click on the consent form and then join.
        logger.info(f"Getting request");
        if not 'user' in request_body:
            logger.info(f"Not finding the user attribute");
            user = await self.module_api.get_user_by_req(request)
            await self.store.hub_join(user.user.to_string())
            user_first_time_joined_status = {"joined": False};    
        else: 
            logger.info(f"Found  the user attribute");
            given_user_id = request_body['user'];
        
        db_result = await self.store.has_joined(given_user_id) 
        
        if db_result:
            user_first_time_joined_status = {"joined": True}
        else:
            await self.store.hub_join(given_user_id)
            user_first_time_joined_status = {"joined": False};
        respond_with_json(request, 200, user_first_time_joined_status, True)