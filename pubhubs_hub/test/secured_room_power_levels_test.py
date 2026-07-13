"""Regression test: secured rooms must let regular members write the Matrix
state events a group video call needs (org.matrix.msc3401.call and its
member event, plus the newer org.matrix.msc4143.rtc.member), not just the
room creator. Without an explicit power level override these default to
Synapse's state_default (50), which a regular joined member (0) can't meet.
"""

import sys
from unittest import IsolatedAsyncioTestCase

sys.path.append("modules")
from pubhubs._secured_rooms_class import SecuredRoom, PubHubsSecuredRoomType

CREATOR = "@creator:example.org"
SERVER_NOTICES_USER = "@notices:example.org"

VIDEO_CALL_EVENT_TYPES = {
    "org.matrix.msc3401.call",
    "org.matrix.msc3401.call.member",
    "org.matrix.msc4143.rtc.member",
}


class FakeRoomCreationHandler:
    def __init__(self):
        self.captured_config = None

    async def create_room(self, requester, config):
        self.captured_config = config
        return ["!securedroom:example.org", None, 1]


class FakePublicRoomListManager:
    async def add_room_to_public_room_list(self, room_id):
        pass


class FakeModuleApi:
    def __init__(self):
        self.public_room_list_manager = FakePublicRoomListManager()

    async def update_room_membership(self, action_user, user, room, type):
        pass


class SecuredRoomPowerLevelsTest(IsolatedAsyncioTestCase):
    async def test_video_call_event_types_are_grantable_by_regular_members(self):
        room = SecuredRoom(
            name="secured",
            topic="secured",
            accepted={"something": {"profile": True, "accepted_values": []}},
            user_txt="",
            type=PubHubsSecuredRoomType.MESSAGES,
        )
        handler = FakeRoomCreationHandler()

        await room.matrix_create(FakeModuleApi(), handler, CREATOR, SERVER_NOTICES_USER)

        events_override = handler.captured_config["power_level_content_override"].get("events", {})
        for event_type in VIDEO_CALL_EVENT_TYPES:
            self.assertIn(event_type, events_override, f"{event_type} must have an explicit power level override")
            self.assertLessEqual(
                events_override[event_type],
                0,
                f"{event_type} must be sendable by a regular member (power level 0)",
            )

    async def test_creator_and_server_notices_user_levels_unchanged(self):
        room = SecuredRoom(
            name="secured",
            topic="secured",
            accepted={"something": {"profile": True, "accepted_values": []}},
            user_txt="",
            type=PubHubsSecuredRoomType.MESSAGES,
        )
        handler = FakeRoomCreationHandler()

        await room.matrix_create(FakeModuleApi(), handler, CREATOR, SERVER_NOTICES_USER)

        users_override = handler.captured_config["power_level_content_override"]["users"]
        self.assertEqual(users_override[CREATOR], 100)
        self.assertEqual(users_override[SERVER_NOTICES_USER], 50)
