import logging

from synapse.http.site import SynapseRequest
from synapse.module_api import ModuleApi
from synapse.http.server import DirectServeJsonResource, respond_with_json, StaticResource, \
    DirectServeHtmlResource, respond_with_html, finish_request
from twisted.web.resource import Resource

from . import IrmaRoomJoiner
from ._constants import SECURED_ROOMS, ATTRIBUTES, ID, ACCEPTED, SERVER_NOTICES_USER, \
    USER_TXT, CLIENT_URL
from ._store import IrmaRoomJoinStore

logger = logging.getLogger("synapse.contrib." + __name__)


class JoinServlet(Resource):
    """Main servlet for the resources necessary to serve the widget in the waiting \
    rooms and handle the disclosed attributes.
    """

    def __init__(
            self,
            config: dict,
            module_api: ModuleApi,
            store: IrmaRoomJoinStore,
            joiner: IrmaRoomJoiner):
        super().__init__()
        self.module_api = module_api
        self.config = config

        self.putChild(b'start', JoinHtml(module_api, config))
        self.putChild(b'assets', Static())
        self.putChild(
            b'irma-endpoint',
            IrmaEndpoint(
                config,
                module_api,
                store,
                joiner))


class IrmaEndpoint(Resource):
    """Servlet that bundles the IRMA endpoints for the javascript client to communicate with.
    """

    def __init__(
            self,
            config: dict,
            module_api: ModuleApi,
            store: IrmaRoomJoinStore,
            joiner: IrmaRoomJoiner):
        super().__init__()
        self.module_api = module_api
        self.config = config
        self.putChild(b'start', IrmaStart(config, module_api))
        self.putChild(b'result', IrmaResult(config, module_api, store, joiner))


class IrmaStart(DirectServeJsonResource):
    """ Servlet containing the endpoint to start the IRMA session.
    Will ask to disclose the attributes as specified in the module configuration
    """

    def __init__(self, config: dict, module_api: ModuleApi):
        super().__init__()
        self.module_api = module_api
        self.config = config

    async def _async_render_GET(self, request):
        http_client = self.module_api.http_client

        maybe_room_id = request.args.get(b"room_id")[0]
        if not maybe_room_id:
            respond_with_json(request, 400, {})
            return

        room_id = maybe_room_id.decode()
        room = next(
            filter(
                lambda x: x["id"] == room_id,
                self.config[SECURED_ROOMS]),
            None)
        logger.debug(f"{room_id=}    and {self.config[SECURED_ROOMS]}")
        if room is None:
            respond_with_json(request, 403, {})
            return

        to_disclose = room[ATTRIBUTES]
        session_request = {
            "@context": "https://irma.app/ld/request/disclosure/v2",
            "disclose": [
                [
                    to_disclose
                ]
            ]
        }

        irma_url = self.config.get("irma_url", "http://localhost:8089")
        answer = await http_client.post_json_get_json(f"{irma_url}/session", session_request)
        # Make sure the 'ultimate' client uses the proxy used by the module.
        answer['sessionPtr']['u'] = self.module_api.public_baseurl + \
                                    '_synapse/client/irmaproxy/' + \
                                    '/'.join(answer['sessionPtr']['u'].split('/')[3:])

        logger.debug(f"rewrote irma url to {answer['sessionPtr']['u']}")

        respond_with_json(request, 200, answer)


class IrmaResult(DirectServeJsonResource):
    """Servlet containing the endpoint the JS client will call when the session is done,
     will collect and check the session result and see if
      correct attributes are disclosed.
      If so will return the url of the room the waiting room was for.
    """

    def __init__(
            self,
            config: dict,
            module_api: ModuleApi,
            store: IrmaRoomJoinStore,
            irma_room_joiner: IrmaRoomJoiner):
        super().__init__()
        self.module_api = module_api
        self.config = config
        self.store = store
        self.irma_room_joiner = irma_room_joiner

    def check_allowed(self, result: dict, room_id: str) -> bool:
        """Check whether the IRMA result fits the entry requirements of the room.

        :param result: IRMA session result
        :param room_id: the id of the room to join
        :return: whether the result fits in the entry requirements of the given room
        """
        logger.debug(f"'{result=}' after a disclose")

        if result.get("proofStatus") is None:
            return False

        if result["proofStatus"] == "VALID":

            if result.get("disclosed") is None:
                return False

            disclosed = result.get("disclosed")[0]

            if len(disclosed) < 1:
                return False

            room = next(
                filter(
                    lambda x: x[ID] == room_id,
                    self.config[SECURED_ROOMS]),
                None)
            if room is None:
                return False

            # Empty means all disclosed attributes are accepted
            if len(room[ACCEPTED]) == 0:
                return True

            for attribute in disclosed:
                id = attribute.get("id")
                value = attribute.get("rawvalue")
                to_check_against = next(
                    filter(
                        lambda x: list(
                            x.keys())[0] == id,
                        room[ACCEPTED]))
                if value in list(to_check_against.values())[0]:
                    continue
                else:
                    return False

        return True

    async def _async_render_GET(self, request: SynapseRequest):
        http_client = self.module_api.http_client

        if not request.args.get(b"session_token") or not request.args.get(
                b"room_id") or not request.args.get(b"access_token"):
            respond_with_json(request, 400, {})
            return

        token = b''.join(request.args.get(b"session_token")).decode()
        room_id = b''.join(request.args.get(b"room_id")).decode()
        login_token = b''.join(request.args.get(b"access_token")).decode()
        user_id = None
        result = await self.store.user_and_waiting_from_token(login_token)

        if result:
            user_id = result[0]

        # The token is expired, let's make a new widget with a refreshed token
        # allowing the user to retry disclosing.
        if user_id is None:
            new_token = await self.store.refresh_token(login_token)
            # This call should always succeed since we just refreshed the token.
            user, waiting_room_id = await self.store.user_and_waiting_from_token(new_token)
            await self.irma_room_joiner.send_msg_with_link_to_join(self.config[SERVER_NOTICES_USER], room_id,
                                                                   waiting_room_id, user, new_token)
            respond_with_json(
                request, 200, {
                    "not_correct": "unfortunately not allowed in the room"})
            return

        irma_url = self.config.get("irma_url", "http://localhost:8089")
        result = await http_client.get_json(f"{irma_url}/session/{token}/result")

        if self.check_allowed(result, room_id):
            await self._allow_user_to_join_and_delete_waiting_room(room_id, user_id)

            answer = {"goto": f"{self.config[CLIENT_URL]}#/room/{room_id}"}
            respond_with_json(request, 200, answer)
            return
        else:
            respond_with_json(
                request, 200, {
                    "not_correct": "unfortunately not allowed in the room"})
            return

    async def _allow_user_to_join_and_delete_waiting_room(self, room_id, user_id):
        await self.store.allow(user_id, room_id)
        await self.module_api.update_room_membership(user_id, user_id, room_id, 'join')
        (waiting_room, _token) = await self.store.valid_waiting_room(user_id, room_id)
        server_notices_user = self.config[SERVER_NOTICES_USER]
        await self.module_api.update_room_membership(user_id, user_id, waiting_room, 'leave')
        await self.module_api.update_room_membership(server_notices_user, server_notices_user, waiting_room, 'leave')


class Static(Resource):
    """Static resources to serve.
    """

    def __init__(self):
        super().__init__()
        self.putChild(b'irma.js', StaticResource(
            '/pub_hubs_templates/irma.js'))
        self.putChild(b'irma.css', StaticResource(
            '/pub_hubs_templates/irma.css'))


class JoinHtml(DirectServeHtmlResource):
    def __init__(self, module_api: ModuleApi, config):
        super().__init__()
        self.config = config
        self.module_api = module_api

        self.templates = self.module_api.read_templates(["start.html"],
                                                        "/pub_hubs_templates")

    async def _async_render_GET(self, request):
        room_id = b''.join(request.args.get(b"room_id")).decode()

        room = next(
            filter(
                lambda x: x[ID] == room_id,
                self.config[SECURED_ROOMS]))

        render = self.templates[0].render(user_txt=room[USER_TXT])
        request.setHeader(
            b"Access-Control-Allow-Origin",
            f"{self.config[CLIENT_URL]}".encode())

        self._custom_no_click_jacking_protection_respond_with_html(
            request, 200, render)

    def _custom_no_click_jacking_protection_respond_with_html(
            self, request: SynapseRequest, code: int, render: str):
        """Copied from respond_with_html from the module api: synapse.module_api.ModuleApi.respond_with_html but WITHOUT the
        clickjacking prevention headers. So in general do not use
        """

        html_bytes = render.encode("utf-8")
        # The response code must always be set, for logging purposes.
        request.setResponseCode(code)

        # could alternatively use request.notifyFinish() and flip a flag when
        # the Deferred fires, but since the flag is RIGHT THERE it seems like a waste.
        if request._disconnected:
            logger.warning(
                "Not sending response to request %s, already disconnected.",
                request)
            return

        request.setHeader(b"Content-Type", b"text/html; charset=utf-8")
        request.setHeader(b"Content-Length", b"%d" % (len(html_bytes),))

        # Originally ensures this content cannot be embedded.
        # line below commented out:
        # set_clickjacking_protection_headers(request)

        request.setHeader(
            b"Content-Security-Policy",
            f"frame-ancestors {self.config[CLIENT_URL]};".encode())

        request.write(html_bytes)
        finish_request(request)
