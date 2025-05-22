import logging
from typing import Optional

from synapse.http.site import SynapseRequest
from synapse.module_api import ModuleApi
from synapse.http.server import DirectServeJsonResource, respond_with_json
from synapse.types import JsonDict
from twisted.web.resource import Resource

import time
from ._constants import SERVER_NOTICES_USER, CLIENT_URL
from ._secured_rooms_class import RoomAttribute
from ._store import HubStore

import json
import re

logger = logging.getLogger("synapse.contrib." + __name__)

# actually, yivi session tokens are always 20 characters long, but
# let's not assume that in case they change that one day
yivi_token_regex = re.compile("[a-zA-Z0-9]*")


class JoinServlet(Resource):
    """Main servlet to handle the disclosed attributes."""

    def __init__(self, config: dict, module_api: ModuleApi, store: HubStore):
        super().__init__()
        self.module_api = module_api
        self.config = config

        self.putChild(b"yivi-endpoint", YiviEndpoint(config, module_api, store))



class YiviEndpoint(Resource):
    """Servlet that bundles the Yivi endpoints for the javascript client to communicate with."""

    def __init__(self, config: dict, module_api: ModuleApi, store: HubStore):
        super().__init__()
        self.module_api = module_api
        self.config = config
        self.putChild(b"start", YiviStart(config, module_api, store))
        self.putChild(b"result", YiviResult(config, module_api, store))


class YiviStart(DirectServeJsonResource):
    """Servlet containing the endpoint to start the Yivi session.
    Will ask to disclose the attributes as specified in the module configuration
    """

    def __init__(self, config: dict, module_api: ModuleApi, store: HubStore):
        super().__init__()
        self.module_api = module_api
        self.config = config
        self.store = store

    async def _async_render_GET(self, request):
        http_client = self.module_api.http_client

        maybe_room_id = request.args.get(b"room_id")[0]
        if not maybe_room_id:
            respond_with_json(request, 400, {})
            return

        room_id = maybe_room_id.decode()
        room = await self.store.get_secured_room(room_id)

        if room is None:
            respond_with_json(request, 403, {})
            return

        to_disclose = list(room.accepted.keys())
        session_request = {"@context": "https://irma.app/ld/request/disclosure/v2", "disclose": [[to_disclose]]}

        yivi_url = self.config.get("yivi_url", "http://localhost:8089")
        answer = await http_client.post_json_get_json(f"{yivi_url}/session", session_request)

        # Make sure the 'ultimate' client uses the proxy used by the module.
        public_yivi_url = self.config.get("public_yivi_url", self.module_api.public_baseurl)
        answer["sessionPtr"]["u"] = (
            public_yivi_url + "_synapse/client/yiviproxy/irma/" + answer["sessionPtr"]["u"]
        )

        logger.debug(f"rewrote Yivi url to {answer['sessionPtr']['u']}")

        # Now client makes the request
        request.setHeader(b"Access-Control-Allow-Origin", f"{self.config[CLIENT_URL]}".encode())

        respond_with_json(request, 200, answer)

    # For now, POST requests are just forwarded to the yivi server as a session request.
    async def _async_render_POST(self, request):
        http_client = self.module_api.http_client
        request_body_bytes = request.content.getvalue()

        if request_body_bytes is None:
            respond_with_json(request, 400, {})
            return

        # Returns a dict
        request_body = json.loads(request_body_bytes)

        yivi_url = self.config.get("yivi_url", "http://localhost:8089")
        answer = await http_client.post_json_get_json(f"{yivi_url}/session", request_body)

        # Make sure the 'ultimate' client uses the proxy used by the module.
        public_yivi_url = self.config.get("public_yivi_url", self.module_api.public_baseurl)
        answer["sessionPtr"]["u"] = (
            public_yivi_url + "_synapse/client/yiviproxy/irma/" + answer["sessionPtr"]["u"]
        )

        logger.debug(f"rewrote Yivi url to {answer['sessionPtr']['u']}")

        # Now client makes the request
        request.setHeader(b"Access-Control-Allow-Origin", f"{self.config[CLIENT_URL]}".encode())

        respond_with_json(request, 200, answer)


class YiviResult(DirectServeJsonResource):
    """Servlet containing the endpoint the JS client will call when the session is done,
    will collect and check the session result and see if
     correct attributes are disclosed.
     If so will return the url of the room the waiting room was for.
    """

    def __init__(self, config: dict, module_api: ModuleApi, store: HubStore):
        super().__init__()
        self.module_api = module_api
        self.config = config
        self.store = store

    async def check_allowed(self, result: dict, room_id: str) -> Optional[JsonDict]:
        """Check whether the Yivi result fits the entry requirements of the room.

        :param result: Yivi session result
        :param room_id: the id of the room to join
        :return: None is not allowed and the disclosed attributes when allowed.
        """
        logger.debug(f"'{result=}' after a disclose")

        if result.get("proofStatus") is None:
            return None

        if result["proofStatus"] == "VALID":
            if result.get("disclosed") is None:
                return None

            disclosed = result.get("disclosed")[0]

            if len(disclosed) < 1:
                return None

            room = await self.store.get_secured_room(room_id)

            if room is None:
                return None

            disclosed_to_show = {}

            disclosed_attributes = {}
            for attribute in disclosed:
                id = attribute.get("id")
                value = attribute.get("rawvalue")
                disclosed_attributes[id] = value

            for required in room.accepted.keys():
                disclosed_value = disclosed_attributes.get(required, None)
                if disclosed_value:
                    room_attribute: RoomAttribute = room.accepted[required]
                    if room_attribute:
                        if (
                            len(room_attribute.accepted_values) == 0
                            or disclosed_value in room_attribute.accepted_values
                        ):
                            if room_attribute.profile:
                                disclosed_to_show[required] = disclosed_value
                            else:
                                disclosed_to_show[required] = ""
                        else:
                            return None
                    else:
                        return None
                else:
                    return None

            return disclosed_to_show
        else:
            return None

    async def _async_render_GET(self, request: SynapseRequest):
        http_client = self.module_api.http_client

        request.setHeader(b"Access-Control-Allow-Origin", f"{self.config[CLIENT_URL]}".encode())

        if not request.args.get(b"session_token") or not request.args.get(b"room_id"):
            respond_with_json(request, 400, {})
            return

        token = b"".join(request.args.get(b"session_token")).decode()
        room_id = b"".join(request.args.get(b"room_id")).decode()

        if not yivi_token_regex.fullmatch(token):
            respond_with_json(request, 400, {})

        user = await self.module_api.get_user_by_req(request)

        user_id = user.user.to_string()



        yivi_url = self.config.get("yivi_url", "http://localhost:8089")
        result = await http_client.get_json(f"{yivi_url}/session/{token}/result")
        allowed = await self.check_allowed(result, room_id)
        if allowed:
            await self.store.allow(user_id, room_id, time.time())
            await self.module_api.update_room_membership(user_id, user_id, room_id, "join")

            answer = {
                    "goto": f"{self.config[CLIENT_URL]}#/room/{room_id}"

                     }


            disclosed = allowed

            await self.module_api.create_and_send_event_into_room(
                {
                    "type": "m.room.message",
                    "room_id": room_id,
                    "sender": self.config[SERVER_NOTICES_USER],
                    "content": {
                        "body": f"{user_id} joined the room with attributes {disclosed}",
                        "msgtype": "m.notice",
                    },
                }
            )

            respond_with_json(request, 200, answer)
        else:
            respond_with_json(request, 200, {"not_correct": "unfortunately not allowed in the room"})

    async def _async_render_POST(self, request: SynapseRequest):
        http_client = self.module_api.http_client

        #? Why is this necessary?
        request.setHeader(b"Access-Control-Allow-Origin", f"{self.config[CLIENT_URL]}".encode())

        token = b"".join(request.args.get(b"session_token")).decode()

        if not yivi_token_regex.fullmatch(token):
            respond_with_json(request, 400, {})

        yivi_url = self.config.get("yivi_url", "http://localhost:8089")
        result = await http_client.get_json(f"{yivi_url}/session/{token}/result")

        logger.debug(f"Retrieved yivi result {result}")

        respond_with_json(request, 200, result)
