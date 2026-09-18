"""Regression tests for room_id extraction during request validation.

Endpoints like PUT /_synapse/client/steward/secured_rooms carry the room_id in the
request body only. When get_room_id_from_request looked at the query string alone it
returned None, assert_has_power_level raised InsufficientPowerLevelError before ever
reading the room's power levels, and user_validator fell back to the hub-admin check.
Stewards (power level 50) therefore got a 403 on every room they had not created
themselves.

The body is read twice: once here and once by the handler that runs afterwards. So
the stream has to be rewound in all cases, also when it holds no valid JSON.
"""

import io
import json
import sys
from unittest import IsolatedAsyncioTestCase, TestCase
from unittest.mock import patch

sys.path.append("modules")
from pubhubs import _validation
from pubhubs._constants import STEWARD
from pubhubs._validation import get_room_id_from_request, user_validator

ROOM_ID = "!securedroom:example.org"
STEWARD_USER = "@steward:example.org"


class FakeRequest:
    """Minimal stand-in for a SynapseRequest: query args plus a body stream."""

    def __init__(self, room_id=None, body=None, raw_body=None):
        self.args = {}
        if room_id is not None:
            self.args[b"room_id"] = [room_id.encode()]
        if raw_body is None:
            raw_body = json.dumps(body).encode() if body is not None else b""
        self.content = io.BytesIO(raw_body)


class GetRoomIdFromRequestTest(TestCase):
    def test_reads_room_id_from_query_parameters(self):
        request = FakeRequest(room_id=ROOM_ID)

        self.assertEqual(get_room_id_from_request(request), ROOM_ID)

    def test_reads_room_id_from_body_when_not_in_query(self):
        """The #2038 regression: a body-only room_id must be found."""
        request = FakeRequest(body={"room_id": ROOM_ID, "name": "new name"})

        self.assertEqual(get_room_id_from_request(request), ROOM_ID)

    def test_query_parameter_takes_precedence_over_body(self):
        request = FakeRequest(room_id=ROOM_ID, body={"room_id": "!other:example.org"})

        self.assertEqual(get_room_id_from_request(request), ROOM_ID)

    def test_returns_none_when_body_has_no_room_id(self):
        request = FakeRequest(body={"name": "new name"})

        self.assertIsNone(get_room_id_from_request(request))

    def test_body_is_rewound_after_reading(self):
        """The handler parses the same stream afterwards, so it must start at 0."""
        body = {"room_id": ROOM_ID, "name": "new name"}
        request = FakeRequest(body=body)

        get_room_id_from_request(request)

        self.assertEqual(json.loads(request.content.read()), body)

    def test_body_is_rewound_when_body_is_not_json(self):
        """Otherwise the handler sees an empty body and reports 'Content not JSON'."""
        request = FakeRequest(raw_body=b"not json at all")

        self.assertIsNone(get_room_id_from_request(request))
        self.assertEqual(request.content.read(), b"not json at all")

    def test_empty_body_without_query_parameter_returns_none(self):
        request = FakeRequest()

        self.assertIsNone(get_room_id_from_request(request))

    def test_dict_request_without_room_id_returns_none(self):
        """Some callers pass a plain args dict, which has no body to fall back to."""
        self.assertIsNone(get_room_id_from_request({}))
        self.assertEqual(get_room_id_from_request({b"room_id": [ROOM_ID.encode()]}), ROOM_ID)


class FakeUser:
    class _UserID:
        def to_string(self):
            return STEWARD_USER

        def __str__(self):
            return STEWARD_USER

    user = _UserID()


class FakePowerLevelsEvent:
    def __init__(self, users):
        self.content = {"users": users}


class FakeModuleApi:
    """Authenticated steward (power level 50) who is not a hub admin."""

    def __init__(self, power_levels):
        self._power_levels = power_levels

    async def get_user_by_req(self, request):
        return FakeUser()

    async def get_room_state(self, room_id, state_filter):
        return {("m.room.power_levels", ""): FakePowerLevelsEvent(self._power_levels)}

    async def is_user_admin(self, user_id):
        return False


class FakeServlet:
    """Servlet whose handler re-reads the body, like the real steward endpoints do."""

    def __init__(self, module_api):
        self._module_api = module_api
        self.handled_body = None

    @user_validator(STEWARD)
    async def render_PUT(self, request, user_id):
        self.handled_body = json.loads(request.content.read())
        return user_id


class ResponseCapture:
    def __init__(self):
        self.code = None
        self.payload = None
        self.called = False

    def __call__(self, request, code, payload, send_cors=False, *args, **kwargs):
        self.called = True
        self.code = code
        self.payload = payload


class StewardBodyOnlyRequestTest(IsolatedAsyncioTestCase):
    """End-to-end through the decorator, the shape the hub-client actually sends."""

    async def call(self, servlet, request):
        capture = ResponseCapture()
        with patch.object(_validation, "respond_with_json", capture):
            result = await servlet.render_PUT(request)
        return result, capture

    async def test_steward_may_update_a_room_they_did_not_create(self):
        servlet = FakeServlet(FakeModuleApi({STEWARD_USER: STEWARD}))
        body = {"room_id": ROOM_ID, "name": "new name"}

        result, capture = await self.call(servlet, FakeRequest(body=body))

        self.assertFalse(capture.called, f"expected no error response, got {capture.code}")
        self.assertEqual(result, STEWARD_USER)
        self.assertEqual(servlet.handled_body, body, "handler could not re-read the body")

    async def test_regular_member_is_still_rejected(self):
        servlet = FakeServlet(FakeModuleApi({STEWARD_USER: 0}))

        _, capture = await self.call(servlet, FakeRequest(body={"room_id": ROOM_ID}))

        self.assertEqual(capture.code, 403)
        self.assertIsNone(servlet.handled_body, "handler must not have run")
