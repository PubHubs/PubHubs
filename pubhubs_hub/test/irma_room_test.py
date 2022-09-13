from typing import Optional, List
from unittest import IsolatedAsyncioTestCase

import sys
from synapse.config import ConfigError

from synapse.types import (
    Requester,
    UserID
)

sys.path.append("modules")
from pubhubs import IrmaRoomJoiner
from pubhubs._web import IrmaResult


class FakeNoticesManager():
    server_notices_mxid = "@notices_user:domain"


class FakeRoomStore:
    async def store_room(self,
                         room_id="gen_room_id",
                         room_creator_user_id="creator_id",
                         is_public="is_public",
                         room_version="room_version", ):
        return room_id


class HasMain():
    main = FakeRoomStore()


class FakeRoomConfig():
    encryption_enabled_by_default_for_room_presets = {'eh': False}
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
        if type != 'im.vector.setting.allowed_widgets':
            raise Exception


class FakeHsConfig():
    room = FakeRoomConfig
    server = FakeServer
    servernotices = FakeNoticesManager()
    worker = FakeWorker()


class FakeAuth():
    async def check_auth_blocking(self, requester):
        return None


class FakeThirdPartyEventRules():
    async def on_create_room(self, config, is_requester_admin=False):
        return None

    async def check_visibility_can_be_modified(room_id, visibility):
        return True


class FakeRequestRateLimiter:
    async def ratelimit(self, requester):
        return None


class FakeEvencreationHandler:
    async def assert_accepted_privacy_policy(self, requester):
        return True

    async def create_and_send_nonmember_event(self,
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
                                              depth: Optional[int] = None,):
        return (FakeEvent(), 1)


class FakeDirectoryHandler:
    pass


class FakeMemberLinearizer:
    class queue():
        def __init__(self, args):
            pass

        async def __aenter__(self):
            return None

        async def __aexit__(self, a1, a2, a3):
            return None


class FakeRoomMemberHandler:
    async def update_membership( self,
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
                                 depth: Optional[int] = None,):
        return (1,None)

    member_linearizer = FakeMemberLinearizer()


class FakeDataReplicationHandler:
    async def wait_for_stream_position(self, a1=None, a2=None, a3=None):
        pass


class FakeHs():
    hostname = "hostname"

    def get_server_notices_manager(self):
        return FakeNoticesManager()

    def get_datastores(self):
        return HasMain()

    def get_auth(self):
        return FakeAuth()

    def get_clock(self):
        return None

    def get_spam_checker(self):
        return None

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
        pass

    def get_auth_blocking(self):
        return FakeAuth()

class FakeEvent:
    event_id = 'event_id'


class FakeModuleApi():
    def __init__(self, queries={}):
        self.queries = queries
        self.msg_count = 0

    _hs = FakeHs()
    public_baseurl = "http://public/"

    async def run_db_interaction(self, name, txn, *args):
        return self.queries.get(name, None)

    def register_web_resource(self, path, servlet):
        return None

    def read_templates(self, files, folder):
        return None

    def register_spam_checker_callbacks(self, user_may_join_room):
        return None

    def register_account_validity_callbacks(self, on_user_registration):
        return None

    async def update_room_membership(self, action_user, user, room, type):
        pass

    async def create_and_send_event_into_room(self, event):
        if event['type'] not in ['im.vector.modular.widgets', 'io.element.widgets.layout']:
            print(f"Wrong type: '{type}'")
            raise Exception
        self.msg_count += 1
        return FakeEvent()


class Fake_Store:
    pass


valid_config = {
    'secured_rooms': [{
        'id': 'some_id',
        'attributes': ['a'],
        'accepted': [{'a': ['b']}],
        'user_txt': ''
    }],
    'client_url': ''
}


class TestAsync(IsolatedAsyncioTestCase):

    def test_parse_config(self):
        parsed = IrmaRoomJoiner.parse_config(valid_config)
        self.assertEqual(valid_config, parsed)

        for key in valid_config.keys():
            copy = valid_config.copy()
            copy.pop(key)
            self.assertRaises(ConfigError, IrmaRoomJoiner.parse_config, copy)

    async def test_on_trying_to_join_room(self):
        joiner = IrmaRoomJoiner(valid_config.copy(), FakeModuleApi())

        # Join a room that is secured and not already allowed
        result = await joiner.joining('@some_user:domain', 'some_id', None)

        self.assertEqual(result, False)

        # Join a room that is not secured
        result = await joiner.joining('@some_user:domain', 'some_other_id', None)

        self.assertEqual(result, True)

        joiner = IrmaRoomJoiner(valid_config.copy(), FakeModuleApi(queries={"allowed_to_join_room_select": True}))
        # Join a room that is secured and already allowed
        result = await joiner.joining('@some_user:domain', 'some_id', None)

        self.assertEqual(result, True)

    async def test_on_registration(self):
        api = FakeModuleApi()
        joiner = IrmaRoomJoiner(valid_config.copy(), api)

        await joiner.invite_to_all("new_user")

        # Room not set to auto-invite
        self.assertEqual(api.msg_count, 0)

        new_config = valid_config.copy()
        new_config['secured_rooms'][0]['default_invite'] = True
        api = FakeModuleApi()
        joiner = IrmaRoomJoiner(new_config, api)

        await joiner.invite_to_all("new_user")

        # Room set to auto-invite, 2 messages to create and display the widget.
        self.assertEqual(api.msg_count, 2)

    def test_allowed_in(self):
        # Not allowed when nothing is disclosed
        api = FakeModuleApi()
        joiner = IrmaRoomJoiner(valid_config.copy(), api)
        checker = IrmaResult(valid_config.copy(), api, Fake_Store(), joiner)

        result = checker.check_allowed({}, 'some_id')
        self.assertEqual(result, False)

        # Allowed when the right thing is disclosed
        api = FakeModuleApi()
        joiner = IrmaRoomJoiner(valid_config.copy(), api)
        checker = IrmaResult(valid_config.copy(), api, Fake_Store(), joiner)

        result = checker.check_allowed({"proofStatus": "VALID", "disclosed": [[{"id": "a", "rawvalue": "b"}]]},
                                       'some_id')
        self.assertEqual(result, True)

        # Not allowed when the right attribute with the wrong value is disclosed
        api = FakeModuleApi()
        joiner = IrmaRoomJoiner(valid_config.copy(), api)
        checker = IrmaResult(valid_config.copy(), api, Fake_Store(), joiner)

        result = checker.check_allowed({"proofStatus": "VALID", "disclosed": [[{"id": "a", "rawvalue": "a"}]]},
                                       'some_id')
        self.assertEqual(result, False)
