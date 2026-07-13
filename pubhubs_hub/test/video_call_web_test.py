"""Regression tests for VideoCallServlet's room authorization check.

The Yivi-disclosure allow-list (allowed_to_join_room / store.is_allowed) is only
ever populated for secured rooms. VideoCallServlet must not require it for other
room types, mirroring the user_may_join_room distinction in HubClientApi.joining().
"""

import sys
from unittest import IsolatedAsyncioTestCase
from unittest.mock import patch

sys.path.append("modules")
from pubhubs._secured_rooms_class import SecuredRoom, PubHubsSecuredRoomType
from pubhubs import _video_call_web
from pubhubs._video_call_web import VideoCallServlet


USER = "@authenticated_user:example.org"
DM_ROOM = "!dmroom:example.org"
SECURED_ROOM = "!securedroom:example.org"

SECURED_ROOM_OBJ = SecuredRoom(
    name="secured",
    topic="secured",
    accepted={"something": {"profile": True, "accepted_values": []}},
    user_txt="",
    type=PubHubsSecuredRoomType.MESSAGES,
    room_id=SECURED_ROOM,
)


class FakeUser:
    authenticated_entity = USER
    device_id = "DEVICE1"


class FakePowerLevelsEvent:
    def __init__(self, content):
        self.content = content


class FakeModuleApi:
    def __init__(self, power_levels=None):
        self._power_levels = power_levels or {}

    async def get_user_by_req(self, request):
        return FakeUser()

    async def get_room_state(self, room_id, event_filter=None):
        return {("m.room.power_levels", ""): FakePowerLevelsEvent({"users": self._power_levels})}


class FakeStore:
    def __init__(self, rooms=None, allowed=None):
        self._rooms = rooms or {}
        self._allowed = allowed or set()

    async def get_secured_room(self, room_id):
        return self._rooms.get(room_id)

    async def is_allowed(self, user_id, room_id):
        return (user_id, room_id) in self._allowed


class FakeRequest:
    """Only carries query args - the response is captured by patching
    respond_with_json, so we don't need the rest of the twisted Request interface."""

    def __init__(self, room_id=None):
        self.args = {}
        if room_id is not None:
            self.args[b"room_id"] = [room_id.encode()]


class ResponseCapture:
    def __init__(self):
        self.code = None
        self.payload = None
        self.called = False

    def __call__(self, request, code, payload, send_cors=False, *args, **kwargs):
        self.called = True
        self.code = code
        self.payload = payload


def make_servlet(rooms=None, allowed=None, power_levels=None):
    return VideoCallServlet({}, FakeStore(rooms=rooms, allowed=allowed), FakeModuleApi(power_levels=power_levels))


async def call_get(servlet, room_id):
    request = FakeRequest(room_id=room_id)
    capture = ResponseCapture()
    with patch.object(_video_call_web, "respond_with_json", capture):
        await servlet._async_render_GET(request)
    return capture


class VideoCallAuthorizationTest(IsolatedAsyncioTestCase):
    async def test_non_secured_room_does_not_require_disclosure_grant(self):
        servlet = make_servlet(rooms={})  # DM/group room - never registered as secured
        allowed = await servlet._may_use_video_call(USER, DM_ROOM)
        self.assertTrue(allowed, "Video calls in non-secured rooms must not require a Yivi disclosure grant")

    async def test_secured_room_without_disclosure_is_rejected(self):
        servlet = make_servlet(rooms={SECURED_ROOM: SECURED_ROOM_OBJ}, allowed=set())
        allowed = await servlet._may_use_video_call(USER, SECURED_ROOM)
        self.assertFalse(allowed)

    async def test_secured_room_with_disclosure_is_allowed(self):
        servlet = make_servlet(rooms={SECURED_ROOM: SECURED_ROOM_OBJ}, allowed={(USER, SECURED_ROOM)})
        allowed = await servlet._may_use_video_call(USER, SECURED_ROOM)
        self.assertTrue(allowed)

    async def test_room_admin_without_disclosure_is_allowed(self):
        # Room creators/admins are auto-joined at room creation and never go through
        # the Yivi disclosure flow, so they never get a row in allowed_to_join_room.
        servlet = make_servlet(rooms={SECURED_ROOM: SECURED_ROOM_OBJ}, allowed=set(), power_levels={USER: 100})
        allowed = await servlet._may_use_video_call(USER, SECURED_ROOM)
        self.assertTrue(allowed, "Room admins must not be blocked by a disclosure grant that can never exist for them")

    async def test_regular_member_below_admin_threshold_still_requires_disclosure(self):
        servlet = make_servlet(rooms={SECURED_ROOM: SECURED_ROOM_OBJ}, allowed=set(), power_levels={USER: 50})
        allowed = await servlet._may_use_video_call(USER, SECURED_ROOM)
        self.assertFalse(allowed)


class VideoCallServletGetEndpointTest(IsolatedAsyncioTestCase):
    async def test_get_token_succeeds_for_non_secured_room(self):
        servlet = make_servlet(rooms={})

        response = await call_get(servlet, DM_ROOM)

        self.assertEqual(response.code, 200)

    async def test_get_token_rejected_for_secured_room_without_disclosure(self):
        servlet = make_servlet(rooms={SECURED_ROOM: SECURED_ROOM_OBJ})

        response = await call_get(servlet, SECURED_ROOM)

        self.assertEqual(response.code, 403)

    async def test_get_token_succeeds_for_secured_room_with_disclosure(self):
        servlet = make_servlet(rooms={SECURED_ROOM: SECURED_ROOM_OBJ}, allowed={(USER, SECURED_ROOM)})

        response = await call_get(servlet, SECURED_ROOM)

        self.assertEqual(response.code, 200)
