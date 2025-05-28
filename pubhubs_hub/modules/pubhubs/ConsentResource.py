from synapse.http.site import SynapseRequest
from synapse.module_api import ModuleApi
from synapse.http.server import DirectServeJsonResource, respond_with_json
import logging
import json
import os

from .HubClientApiConfig import HubClientApiConfig
from ._store_consent import ConsentStore

logger = logging.getLogger("synapse.contrib.hub_consent")


class ConsentResource(DirectServeJsonResource):
    """
    Resource to check if a user needs to consent to the current terms and to update to the latest accepted consent version
     - GET /_synapse/client/hub_consent?user_id=@user:example.com
     - POST /_synapse/client/hub_consent with body {user_id:string, version:number}
    """
    
    def __init__(self, module_api: ModuleApi, config: HubClientApiConfig):
        super().__init__()
        self._module_api = module_api
        self._module_config = config
        self._store = ConsentStore(module_api)

    
    async def _async_render_GET(self, request: SynapseRequest) -> None:
        """
        This request provides if the user needs consent.

        Responds:
        - needs_consent: true if the hub_consent_version is higher than the currently accepted user_consent_version
        """
        # Use get_user_by_req to validate the access token
        try:
            await self._module_api.get_user_by_req(request)
        except Exception as e:
            respond_with_json(request, 400, {"error": {e}})
            return

        request.setHeader(b"Access-Control-Allow-Origin", self._module_config.hub_client_url.encode())
        
        user_id = request.args.get(b"user_id", [b""])[0].decode("utf-8")

        if not user_id:
            respond_with_json(request, 400, {"error": "Missing user_id parameter"})
            return
        
        try:
            user_consent_version = await self._store.get_user_consent_version( user_id )

            if not user_consent_version:
                respond_with_json(request, 400, {"error": "Could not find user_id in database"})
                return
            
            path = self._module_config.hub_description_path
            if not os.path.exists(path):
                path = self._module_config.default_hub_description_path

            with open(path, 'r') as fd:
                hub_settings_json = json.load(fd)
            
            if 'version' in hub_settings_json:
                hub_consent_version = hub_settings_json["version"]
            else:
                hub_consent_version = 1

            if user_consent_version[0]:
                user_consent_version = user_consent_version[0]
                needs_onboarding = False
            else:
                user_consent_version = 0
                needs_onboarding = True

            needs_consent = int(float(user_consent_version)) != hub_consent_version

            respond_with_json(request, 200, {
                "needs_consent": needs_consent, "needs_onboarding": needs_onboarding
            })
            
        except Exception as e:
            logger.error(f"Error checking consent status: {e}")
            respond_with_json(request, 500, {"error": "Could not check consent status"})

    
    async def _async_render_POST(self, request: SynapseRequest) -> None:
        """
        Update to the consent version the user has accepted.

        Responds:
        - success: true if the database is updated without raising an error
        """
        # Use get_user_by_req to validate the access token
        try:
            await self._module_api.get_user_by_req(request)
        except Exception as e:
            respond_with_json(request, 400, {"error": {e}})
            return

        request.setHeader(b"Access-Control-Allow-Origin", self._module_config.hub_client_url.encode())
        
        try:
            content = request.content.read()
            body = json.loads(content)

   
            user_id = body.get("user_id") 
            accepted_consent_version = body.get("version")
            
            if not all([user_id, accepted_consent_version]):
                respond_with_json(request, 400, {"error": "Missing required parameters"})
                return
            
            try:
                accepted_consent_version_int = int(accepted_consent_version)
            except:
                respond_with_json(request, 400, {"error": "Version parameter should be a value that can be converted to an integer"})
                return
            
            try:
                await self._store.set_user_consent_version( accepted_consent_version_int, user_id )

                respond_with_json(request, 200, {
                    "success": True,
                })
            except Exception as e:
                logger.error(f"Error recording consent: {e}")
                respond_with_json(request, 500, {"error": "Failed to record consent"})
            
        except json.JSONDecodeError:
            respond_with_json(request, 400, {"error": "Invalid JSON"})
        except Exception as e:
            logger.error(f"Error processing consent acceptance: {e}")
            respond_with_json(request, 500, {"error": "Internal server error"})
    

