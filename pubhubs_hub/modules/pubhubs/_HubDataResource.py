import time
from ._constants import DEFAULT_EXPIRATION_TIME_DAYS, DEFAULT_EXPIRATION_TIME_DAYS_WARNING
from synapse.module_api import ModuleApi
from synapse.http.site import SynapseRequest
from synapse.http.server import DirectServeJsonResource, respond_with_json
import logging
import json
import os

from .HubClientApiConfig import HubClientApiConfig
from ._store import HubStore

logger = logging.getLogger("synapse.contrib." + __name__)

class HubDataResource(DirectServeJsonResource):
	"""
	HubDataResource provides a resource for handling hub database related requests.

	Methods:
		async _async_render_GET(request: SynapseRequest) -> bytes:
			Handles GET requests. Validates the user and processes the 'data' query parameter to:
				- Retrieve admin users ('admin_users') or
				- Retrieve latest room timestamps ('timestamps') or
				- Check user consent status and onboarding requirements ('consent')
		async _async_render_POST(request: SynapseRequest) -> bytes:
			Handles POST requests. Validates the user and processes the 'data' query parameter to:
				- Record user consent acceptance ('consent')
					- Expects a JSON body with a 'version' field for consent versioning.
	Example usage:
	    GET <hub_address>/_synapse/client/hub/data?data=timestamps
	"""


	_module_api: ModuleApi
	_module_config: HubClientApiConfig
	_hub_store: HubStore

	def __init__(self, module_api: ModuleApi, module_config: HubClientApiConfig, hub_store: HubStore):
		super().__init__()
		self._module_api = module_api
		self._module_config = module_config
		self._hub_store = hub_store

	async def _user_is_admin(self, user:str) -> bool:
		if not await self._module_api.is_user_admin(user):
			logger.info(f"User {user} is not an admin.")
			return False
			
		return True
		
	async def _async_render_GET(self, request: SynapseRequest) -> bytes:
		# Use get_user_by_req to validate the access token and return the user_id
		try:
			user = await self._module_api.get_user_by_req(request)
		except Exception as e:
			respond_with_json(request, 400, {"error": {e}})
			return
		
		response = {}
		
		data = request.args.get(b"data", [b""])[0].decode("utf-8")

		if not data:
			respond_with_json(request, 400, {"error": "Missing data parameter"})
			return
		
		request.setHeader(b"Access-Control-Allow-Origin", self._module_config.hub_client_url.encode())

		try:
			match data:
				case 'admin_users':
					admins_tuples = await self._hub_store.get_hub_admins()
					response = [admin_tuple[0] for admin_tuple in admins_tuples]
				case 'timestamps':
					response = await self._hub_store.all_rooms_latest_timestamp()
				case 'consent':
					user_consent_version = await self._hub_store.get_user_consent_version( str(user.user) )

					if not user_consent_version:
						respond_with_json(request, 400, {"error": "Could not find user in database"})
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

					response = {
						"needs_consent": needs_consent, "needs_onboarding": needs_onboarding
					}
				case 'removed_from_secured_room':
					room_list = []
					data = await self._hub_store.user_join_time(str(user.user))
					current_timestamp = time.time()
					if not data or len(data) == 0:
						response = {"show_notification": False, "message": "You have not joined a secured room yet."}
					else:
						for element in data:
							is_user_expired = element[2]
							join_room_timestamp = float(element[1])
							room_id = element[0]
							secured_room = await self._hub_store.get_secured_room(room_id)
							if is_user_expired:
								room_list.append({
									"room_id": room_id,
									"type": "removed_from_secured_room",
									"message_values": [secured_room.name, secured_room.expiration_time_days]
								})
							else:
								time_elapsed = current_timestamp - join_room_timestamp
								time_elapsed_days = time_elapsed / (24 * 3600)  # Convert seconds to days

								if time_elapsed_days > secured_room.expiration_time_days - DEFAULT_EXPIRATION_TIME_DAYS_WARNING:
									room_list.append({
										"room_id": room_id,
										"type": "soon_removed_from_secured_room",
										"message_values": [secured_room.name, round(DEFAULT_EXPIRATION_TIME_DAYS - time_elapsed_days)]
									})
					response = room_list

				case _:
					respond_with_json(request, 400, {"error": "Not given a valid data value"})
					return

			respond_with_json(request, 200, response)

		except Exception as e:
			respond_with_json(request, 500, {"error": str(e)})
			return

	async def _async_render_POST(self, request: SynapseRequest) -> bytes:	 
		# Use get_user_by_req to validate the access token and return the user_id
		try:
			user = await self._module_api.get_user_by_req(request)
		except Exception as e:
			respond_with_json(request, 400, {"error": {e}})
			return
		
		response = {}
		
		data = request.args.get(b"data", [b""])[0].decode("utf-8")

		if not data:
			respond_with_json(request, 400, {"error": "Missing data parameter"})
			return
		
		request.setHeader(b"Access-Control-Allow-Origin", self._module_config.hub_client_url.encode())

		content = request.content.read()
		body = json.loads(content)

		try:
			match data:
				case "consent":

					accepted_consent_version = body.get("version")
					
					if not accepted_consent_version:
						respond_with_json(request, 400, {"error": "Missing required version parameter"})
						return
					
					try:
						accepted_consent_version_int = int(accepted_consent_version)
					except:
						respond_with_json(request, 400, {"error": "Version parameter should be a value that can be converted to an integer"})
						return
					
					try:
						await self._hub_store.set_user_consent_version( accepted_consent_version_int, str(user.user) )

						response = {
							"success": True, }
						
					except Exception as e:
						logger.error(f"Error recording consent: {e}")
						respond_with_json(request, 500, {"error": "Failed to record consent"})
						return
				case 'removed_from_secured_room':
					if not await self._user_is_admin(str(user.user)):
						respond_with_json(request, 403, {"error": "User is not an admin"})
						return
					room_id = body.get('room_id')
					await self._hub_store.remove_users_from_secured_room(room_id)
					response = {
							"success": True, }
				case 'remove_allowed_join_room_row':
					room_id = body.get('room_id')
					await self._hub_store.remove_allowed_join_room_row(room_id, str(user.user))
					response = {
						"success": True}
				case _:
					respond_with_json(request, 400, {"error": "Not given a valid data value"})
					return
			
			respond_with_json(request, 200, response)
			
		except json.JSONDecodeError:
			respond_with_json(request, 400, {"error": "Invalid JSON"})
		except Exception as e:
			logger.error(f"Error processing consent acceptance: {e}")
			respond_with_json(request, 500, {"error": f"Internal server error: {e}"})

	

		

