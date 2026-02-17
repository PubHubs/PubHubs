from typing import Optional, List, Tuple, Mapping, Collection
from unittest import IsolatedAsyncioTestCase

import sys

from synapse.config import ConfigError
from synapse.events import EventBase
from synapse.handlers.room import EventContext

from synapse.types import Requester, UserID, StateMap

sys.path.append("modules")
from pubhubs import HubClientApi
from pubhubs._web import YiviResult
from pubhubs._secured_rooms_class import SecuredRoom, PubHubsSecuredRoomType
from pubhubs._secured_rooms_web import SecuredRoomsServlet
from pubhubs.HubClientApiConfig import HubClientApiConfig


class FakeNoticesManager:
    server_notices_mxid = "@notices_user:domain"


class FakeRoomStore:
    async def store_room(
        self,
        room_id="gen_room_id",
        room_creator_user_id="creator_id",
        is_public="is_public",
        room_version="room_version",
    ):
        return room_id


class HasMain:
    main = FakeRoomStore()


class FakeRoomConfig:
    encryption_enabled_by_default_for_room_presets = {"eh": False}
    default_power_level_content_override = None


class FakeVersion:
    identifier = "9"


class FakeServer:
    default_room_version = FakeVersion()


class FakeEventsShardConfig:
    def get_instance(self, room_id):
        return None


class FakeWorker:
    events_shard_config = FakeEventsShardConfig()


class FakeAccountDataHandler:
    async def add_account_data_to_room(self, room, user, type, settings):
        if type != "im.vector.setting.allowed_widgets":
            raise Exception

class FakeClock:
    def looping_call(self, callback, interval_ms):
        # Just a no-op or you can schedule call for tests if needed.
        pass

class FakeRateLimitConfig:
    per_second = 5  # or any positive number that mimics rate limit per second
    burst_count = 10  # possibly needed if accessed, can add more attributes as needed
    key = "rc_room_creation"

class FakeRatelimiting:
    rc_room_creation = FakeRateLimitConfig()

class FakeHsConfig:
    room = FakeRoomConfig
    server = FakeServer
    servernotices = FakeNoticesManager()
    worker = FakeWorker()
    ratelimiting = FakeRatelimiting() 


class FakeState:
    async def get_state_group_for_events(
        self,
        event_ids: Collection[str],
    ) -> Mapping[str, int]:
        return {id: i for (i, id) in [(i, id) for i, id in enumerate(event_ids)]}


class FakeStorageControllers:
    state = FakeState()


class FakeAuth:
    async def check_auth_blocking(self, requester):
        return None


class FakeThirdPartyEventRules:
    async def on_create_room(self, config, is_requester_admin=False):
        return None

    async def check_visibility_can_be_modified(room_id, visibility):
        return True


class FakeRequestRateLimiter:
    async def ratelimit(self, requester):
        return None


class FakeEventContext:
    _state_group = "state_group"


class FakeEvencreationHandler:
    async def assert_accepted_privacy_policy(self, requester):
        return True

    async def create_event(
        self,
        requester: Requester,
        event_dict: dict,
        txn_id: Optional[str] = None,
        allow_no_prev_events: bool = False,
        prev_event_ids: Optional[List[str]] = None,
        auth_event_ids: Optional[List[str]] = None,
        state_event_ids: Optional[List[str]] = None,
        require_consent: bool = True,
        outlier: bool = False,
        historical: bool = False,
        depth: Optional[int] = None,
        state_map: Optional[StateMap[str]] = None,
        for_batch: bool = False,
        current_state_group: Optional[int] = None,
    ):
        return (FakeEvent(), FakeEventContext())

    async def handle_new_client_event(
        self,
        requester: Requester,
        events_and_context: List[Tuple[EventBase, EventContext]],
        ratelimit: bool = True,
        extra_users: Optional[List[UserID]] = None,
        ignore_shadow_ban: bool = False,
    ):
        return FakeEvent

    async def create_and_send_nonmember_event(
        self,
        requester: Requester,
        event_dict: dict,
        allow_no_prev_events: bool = False,
        prev_event_ids: Optional[List[str]] = None,
        state_event_ids: Optional[List[str]] = None,
        ratelimit: bool = True,
        txn_id: Optional[str] = None,
        ignore_shadow_ban: bool = False,
        outlier: bool = False,
        historical: bool = False,
        depth: Optional[int] = None,
    ):
        return (FakeEvent(), 1)


class FakeDirectoryHandler:
    pass


class FakeMemberLinearizer:
    class queue:
        def __init__(self, args):
            pass

        async def __aenter__(self):
            return None

        async def __aexit__(self, a1, a2, a3):
            return None


class FakeRoomMemberHandler:
    async def update_membership(
        self,
        requester: Requester,
        target: UserID,
        room_id: str,
        action: str,
        txn_id: Optional[str] = None,
        remote_room_hosts: Optional[List[str]] = None,
        third_party_signed: Optional[dict] = None,
        ratelimit: bool = True,
        content: Optional[dict] = None,
        new_room: bool = False,
        require_consent: bool = True,
        outlier: bool = False,
        historical: bool = False,
        allow_no_prev_events: bool = False,
        prev_event_ids: Optional[List[str]] = None,
        state_event_ids: Optional[List[str]] = None,
        depth: Optional[int] = None,
    ):
        return (1, None)

    member_linearizer = FakeMemberLinearizer()


class FakeDataReplicationHandler:
    async def wait_for_stream_position(self, a1=None, a2=None, a3=None):
        pass


fake_secured_rooms = {}


class FakeRoomCreationHandler:
    async def create_room(self, config):
        id = f"room_id{len(fake_secured_rooms)}"
        fake_secured_rooms[id] = config
        return [{"room_id": id}, None]


class FakeRoomShutdownHandler:
    pass


class FakeHs:
    hostname = "hostname"
    def get_clock(self):
        return FakeClock()

    def get_server_notices_manager(self):
        return FakeNoticesManager()

    def get_datastores(self):
        return HasMain()

    def get_auth(self):
        return FakeAuth()

    def get_event_creation_handler(self):
        return FakeEvencreationHandler()

    def get_room_member_handler(self):
        return FakeRoomMemberHandler()

    def get_event_auth_handler(self):
        return None

    config = FakeHsConfig()

    def get_request_ratelimiter(self):
        return FakeRequestRateLimiter()

    def get_replication_data_handler(self):
        return FakeDataReplicationHandler()

    def get_third_party_event_rules(self):
        return FakeThirdPartyEventRules

    def get_directory_handler(self):
        return FakeDirectoryHandler()

    def get_account_data_handler(self):
        return FakeAccountDataHandler()

    def get_storage_controllers(self):
        return FakeStorageControllers()

    def get_auth_blocking(self):
        return FakeAuth()

    def get_room_creation_handler(self):
        return FakeRoomCreationHandler()

    def get_module_api_callbacks(self):
        return FakeModuleApiCallbacks()


class FakeModuleApiCallbacks:
    spam_checker = None
    third_party_event_rules = None


class FakeMetaData:
    stream_ordering = "ordering"


class FakeEvent:
    event_id = ("event_id",)
    type = ("type",)
    state_key = "state key"
    internal_metadata = FakeMetaData


class Fuser:
    class User:
        def to_string(self):
            return "user"

    user = User()


class FakeModuleApi:
    def __init__(self, allAdmins=False):
        self.msg_count = 0
        self.allAdmins = allAdmins

    _hs = FakeHs()
    public_baseurl = "http://public/"

    async def get_user_by_req(self, request):
        return Fuser()

    async def is_user_admin(self, user):
        return self.allAdmins

    def register_web_resource(self, path, servlet):
        return None

    def read_templates(self, files, folder):
        return None

    def register_spam_checker_callbacks(self, user_may_join_room):
        return None

    async def update_room_membership(self, action_user, user, room, type):
        pass

    async def looping_background_call(self, remove_user, polling_interval):
        pass


class FakeStore:
    def __init__(self, isAllowed=False):
        self.isAllowed = isAllowed

    async def get_secured_room(self, room_id):
        return fake_secured_rooms.get(room_id, None)

    async def is_allowed(self, user, room):
        return self.isAllowed

    async def create_tables(self):
        pass

    async def get_secured_rooms(self):
        return fake_secured_rooms.values()

    async def remove_from_room(self):
        pass
valid_config = {"client_url": "", "global_client_url": ""}



class TestAsync(IsolatedAsyncioTestCase):
    async def test_on_trying_to_join_room(self):
        api = FakeModuleApi()
        joiner = HubClientApi(valid_config, api, FakeStore(), is_test=True)
        fake_secured_rooms["some_id"] = SecuredRoom(
            name="a",
            topic="a",
            accepted={"something": {"profile": True, "accepted_values": ["has a requirement"]}},
            user_txt="",
            type=PubHubsSecuredRoomType.MESSAGES,
            room_id="some_id",
        )

        # Join a room that is secured and not already allowed
        result = await joiner.joining("@some_user:domain", "some_id", None)

        self.assertEqual(result, False)

        # Join a room that is not secured
        result = await joiner.joining("@some_user:domain", "some_other_id", None)

        self.assertEqual(result, True)
        
        joiner = HubClientApi(valid_config, api, FakeStore(isAllowed=True), is_test=True)
        # Join a room that is secured and already allowed
        result = await joiner.joining("@some_user:domain", "some_id", None)

        self.assertEqual(result, True)

    async def test_allowed_in(self):
        # Not allowed when nothing is disclosed
        api = FakeModuleApi()
        # Create the secured room
        fake_secured_rooms["some_id"] = SecuredRoom(
            name="b",
            topic="b",
            accepted={"something": {"profile": True, "accepted_values": ["has a requirement"]}},
            user_txt="",
            type=PubHubsSecuredRoomType.MESSAGES,
            room_id="some_id",
        )
        
        joiner = HubClientApi(valid_config, api, FakeStore(), is_test=True)
        checker = YiviResult(valid_config, api, FakeStore())

        result = await checker.check_allowed({}, "some_id")
        self.assertEqual(result, None)

        # Allowed when the right thing is disclosed
        joiner = HubClientApi(valid_config, api, FakeStore(), is_test=True)
        checker = YiviResult(valid_config, api, FakeStore())

        result = await checker.check_allowed(
            {"proofStatus": "VALID", "disclosed": [[{"id": "something", "rawvalue": "has a requirement"}]]}, "some_id"
        )
        self.assertEqual(result, {"something": "has a requirement"})

        # Not allowed when the right attribute with the wrong value is disclosed
        joiner = HubClientApi(valid_config, api, FakeStore(), is_test=True)
        checker = YiviResult(valid_config, api, FakeStore())

        result = await checker.check_allowed(
            {"proofStatus": "VALID", "disclosed": [[{"id": "something", "rawvalue": "wrong value"}]]}, "some_id"
        )
        self.assertEqual(result, None)

        # Not allowed when required attribute not given
        result = await checker.check_allowed(
            {"proofStatus": "VALID", "disclosed": [[{"id": "not something", "rawvalue": "has a requirement"}]]},
            "some_id",
        )
        self.assertEqual(result, None)

        # Allowed when no values given
        fake_secured_rooms["some_id"] = SecuredRoom(
            name="c",
            topic="c",
            accepted={"something": {"profile": True, "accepted_values": []}},
            user_txt="",
            type=PubHubsSecuredRoomType.MESSAGES,
            room_id="some_id",
        )

        result = await checker.check_allowed(
            {"proofStatus": "VALID", "disclosed": [[{"id": "something", "rawvalue": "should not matter"}]]}, "some_id"
        )
        self.assertEqual(result, {"something": "should not matter"})

        # All required should be met
        fake_secured_rooms["some_id"] = SecuredRoom(
            name="d",
            topic="d",
            accepted={
                "something": {"profile": True, "accepted_values": []},
                "something_else": {"profile": False, "accepted_values": []},
            },
            user_txt="",
            type=PubHubsSecuredRoomType.MESSAGES,
            room_id="some_id",
        )

        result = await checker.check_allowed(
            {"proofStatus": "VALID", "disclosed": [[{"id": "something", "rawvalue": "should not matter"}]]}, "some_id"
        )
        self.assertEqual(result, None)

        # Only profile variables returned to show in the room
        result = await checker.check_allowed(
            {
                "proofStatus": "VALID",
                "disclosed": [
                    [{"id": "something", "rawvalue": "should not matter"}, {"id": "something_else", "rawvalue": "a"}]
                ],
            },
            "some_id",
        )
        self.assertEqual(result, {"something": "should not matter", "something_else": ""})

    async def test_routes_secured(self):
        api = FakeModuleApi()
        config = HubClientApiConfig(valid_config, api)
        servlet = SecuredRoomsServlet(
            config,
            api,
            FakeModuleApi(),
            FakeRoomCreationHandler(),
            FakeRoomShutdownHandler(),
        )
        
        for method in [
            servlet._async_render_DELETE,
            servlet._async_render_GET,
            servlet._async_render_POST,
            servlet._async_render_PUT,
        ]:

        # These requests are empty which throws invalid json error. 
        # For now, we suppress the error that happens from synapse side.
        # TODO A better test case would be to mock the request and test the body.

            with self.assertRaises((AttributeError, PermissionError)):
                await method({})
