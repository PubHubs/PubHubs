import time
from ._constants import DEFAULT_EXPIRATION_TIME_DAYS_WARNING
from synapse.module_api import ModuleApi
from synapse.http.site import SynapseRequest
from synapse.http.server import DirectServeJsonResource, respond_with_json

import logging
import json
import os

from .HubClientApiConfig import HubClientApiConfig
from ._store import HubStore
from ._validation import assert_is_admin, user_validator
from ._cors import set_allow_origin_header

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
	_config: HubClientApiConfig
	_hub_store: HubStore

	def __init__(self, module_api: ModuleApi, config: HubClientApiConfig, hub_store: HubStore):
		super().__init__()
		self._module_api = module_api
		self._config = config
		self._hub_store = hub_store

	@user_validator() 
	async def _async_render_GET(self, request: SynapseRequest, user_id: str) -> bytes:
		

		set_allow_origin_header(request, self._config.allowed_origins)
		
		response = {}
		
		data = request.args.get(b"data", [b""])[0].decode("utf-8")

		if not data:
			respond_with_json(request, 400, {"error": "Missing data parameter"})
			return

		match data:
			case 'admin_users':
				admins_tuples = await self._hub_store.get_hub_admins()
				response = [admin_tuple[0] for admin_tuple in admins_tuples]
			case 'timestamps':
				response = await self._hub_store.all_rooms_latest_timestamp()
			case 'consent':
				user_consent_version = await self._hub_store.get_user_consent_version( user_id )

				if not user_consent_version:
					respond_with_json(request, 400, {"error": "Could not find user in database"})
					return
				
				path = self._config.hub_description_path
				if not os.path.exists(path):
					path = self._config.default_hub_description_path

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
				# Get all rows from the allowed_to_join_room table for the user_id
				allowed_to_join_room = await self._hub_store.user_join_time(user_id)
				room_notifications = []

				if allowed_to_join_room:
					for row in allowed_to_join_room:
						room_id = row[0]
						join_room_timestamp = float(row[1])
						is_user_expired = row[2]
						secured_room = await self._hub_store.get_secured_room(room_id)

						if not secured_room:
							# Room removed but allowed_to_join_room row still present
							await self._hub_store.remove_allowed_join_room_row(room_id, user_id)
							continue

						if is_user_expired:
							room_notifications.append({
								"room_id": room_id,
								"type": "removed_from_secured_room",
								"message_values": [secured_room.name, secured_room.expiration_time_days]
							})
							continue

						current_timestamp = time.time()
						time_elapsed_days = (current_timestamp - join_room_timestamp) / (24 * 3600)

						warning_threshold = int(float(secured_room.expiration_time_days)) - DEFAULT_EXPIRATION_TIME_DAYS_WARNING
						if time_elapsed_days > warning_threshold:
							room_notifications.append({
								"room_id": room_id,
								"type": "soon_removed_from_secured_room",
								"message_values": [secured_room.name, round(int(float(secured_room.expiration_time_days)) - time_elapsed_days)]
							})

				response = room_notifications

			case _:
				respond_with_json(request, 400, {"error": "Not given a valid data value"})
				return

		respond_with_json(request, 200, response)


	@user_validator() 
	async def _async_render_POST(self, request: SynapseRequest, user_id: str) -> bytes:
		
			
		set_allow_origin_header(request, self._config.allowed_origins)
		
		response = {}
		
		data = request.args.get(b"data", [b""])[0].decode("utf-8")

		if not data:
			respond_with_json(request, 400, {"error": "Missing data parameter"})
			return
		
		content = request.content.read()
		body = json.loads(content)

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
					await self._hub_store.set_user_consent_version( accepted_consent_version_int, user_id )

					response = {
						"success": True, }
					
				except Exception as e:
					logger.error(f"Error recording consent: {e}")
					respond_with_json(request, 500, {"error": "Failed to record consent"})
					return
			case 'removed_from_secured_room':
				if not await assert_is_admin(user_id, request, self._module_api):
					return
				room_id = body.get('room_id')
				await self._hub_store.remove_users_from_secured_room(room_id)
				response = {
						"success": True, }
			case 'remove_allowed_join_room_row':
				room_id = body.get('room_id')
				await self._hub_store.remove_allowed_join_room_row(room_id, user_id)
				response = {
					"success": True}
			case _:
				respond_with_json(request, 400, {"error": "Not given a valid data value"})
				return
		
		respond_with_json(request, 200, response)
			