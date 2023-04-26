import logging
from typing import Optional

from synapse.http.site import SynapseRequest
from synapse.module_api import ModuleApi
from synapse.http.server import DirectServeJsonResource, respond_with_json
from synapse.types import JsonDict
from twisted.web.resource import Resource

from . import YiviRoomJoiner
from ._constants import SERVER_NOTICES_USER, CLIENT_URL
from ._secured_rooms_class import RoomAttribute
from ._store import YiviRoomJoinStore

logger = logging.getLogger("synapse.contrib." + __name__)


class JoinServlet(Resource):
    """Main servlet to handle the disclosed attributes.
    """

    def __init__(
            self,
            config: dict,
            module_api: ModuleApi,
            store: YiviRoomJoinStore,
            joiner: YiviRoomJoiner):
        super().__init__()
        self.module_api = module_api
        self.config = config

        self.putChild(
            b'yivi-endpoint',
            YiviEndpoint(
                config,
                module_api,
                store,
                joiner))


class YiviEndpoint(Resource):
    """Servlet that bundles the Yivi endpoints for the javascript client to communicate with.
    """

    def __init__(
            self,
            config: dict,
            module_api: ModuleApi,
            store: YiviRoomJoinStore,
            joiner: YiviRoomJoiner):
        super().__init__()
        self.module_api = module_api
        self.config = config
        self.putChild(b'start', YiviStart(config, module_api, store))
        self.putChild(b'result', YiviResult(config, module_api, store, joiner))


class YiviStart(DirectServeJsonResource):
    """ Servlet containing the endpoint to start the Yivi session.
    Will ask to disclose the attributes as specified in the module configuration
    """

    def __init__(self, config: dict, module_api: ModuleApi, store: YiviRoomJoinStore):
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
        session_request = {
            "@context": "https://irma.app/ld/request/disclosure/v2",
            "disclose": [
                [
                    to_disclose
                ]
            ]
        }

        yivi_url = self.config.get("yivi_url", "http://localhost:8089")
        answer = await http_client.post_json_get_json(f"{yivi_url}/session", session_request)
        # Make sure the 'ultimate' client uses the proxy used by the module.
        public_yivi_url = self.config.get("public_yivi_url", self.module_api.public_baseurl)
        answer['sessionPtr']['u'] = public_yivi_url + \
                                    '_synapse/client/yiviproxy/' + \
                                    '/'.join(answer['sessionPtr']['u'].split('/')[3:])

        logger.debug(f"rewrote Yivi url to {answer['sessionPtr']['u']}")

        # Now client makes the request
        request.setHeader(
            b"Access-Control-Allow-Origin",
            f"{self.config[CLIENT_URL]}".encode())

        respond_with_json(request, 200, answer)


class YiviResult(DirectServeJsonResource):
    """Servlet containing the endpoint the JS client will call when the session is done,
     will collect and check the session result and see if
      correct attributes are disclosed.
      If so will return the url of the room the waiting room was for.
    """

    def __init__(
            self,
            config: dict,
            module_api: ModuleApi,
            store: YiviRoomJoinStore,
            yivi_room_joiner: YiviRoomJoiner):
        super().__init__()
        self.module_api = module_api
        self.config = config
        self.store = store
        self.yivi_room_joiner = yivi_room_joiner

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
                        if len(room_attribute.accepted_values) == 0 or disclosed_value in room_attribute.accepted_values:
                            if room_attribute.profile:
                                disclosed_to_show[required] = disclosed_value
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

        request.setHeader(
            b"Access-Control-Allow-Origin",
            f"{self.config[CLIENT_URL]}".encode())

        if not request.args.get(b"session_token") or not request.args.get(
                b"room_id"):
            respond_with_json(request, 400, {})
            return

        token = b''.join(request.args.get(b"session_token")).decode()
        room_id = b''.join(request.args.get(b"room_id")).decode()

        user = await self.module_api.get_user_by_req(request)

        user_id = user.user.to_string()

        yivi_url = self.config.get("yivi_url", "http://localhost:8089")
        result = await http_client.get_json(f"{yivi_url}/session/{token}/result")
        allowed = await self.check_allowed(result, room_id)
        if allowed:
            await self.store.allow(user_id,room_id)
            await self.module_api.update_room_membership(user_id, user_id, room_id, 'join')

            answer = {"goto": f"{self.config[CLIENT_URL]}#/room/{room_id}"}

            disclosed = allowed

            await self.module_api.create_and_send_event_into_room({
                'type': 'm.room.message',
                'room_id': room_id,
                'sender': self.config[SERVER_NOTICES_USER],
                'content': {
                    "body": f"{user_id} joined the room with attributes {disclosed}",
                    "msgtype": "m.notice"
                }
            })

            respond_with_json(request, 200, answer)
        else:
            respond_with_json(
                request, 200, {
                    "not_correct": "unfortunately not allowed in the room"})
