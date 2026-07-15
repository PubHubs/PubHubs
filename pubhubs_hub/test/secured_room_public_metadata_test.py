"""Regression tests for SecuredRoomPublicMetadataServlet.
Important so that by mistake someone cannot leak information. This test will fail
"""

import json
import sys
from unittest import IsolatedAsyncioTestCase
from unittest.mock import patch

from synapse.api.errors import SynapseError

sys.path.append("modules")
from pubhubs._secured_rooms_class import SecuredRoom, PubHubsSecuredRoomType
from pubhubs import _secured_rooms_web
from pubhubs._secured_rooms_web import SecuredRoomPublicMetadataServlet


# A SecuredRoom that mimics the real-world "PubHubs" room that leaked:
# an email-gated room with a list of accepted email addresses.
SENSITIVE_EMAIL_ALLOWLIST = [
    "alice@example.org",
    "bob@example.org",
    "carol@example.org",
]

ROOM_WITH_EMAIL_ALLOWLIST = SecuredRoom(
    name="PubHubs",
    topic="PubHubs",
    accepted={
        "pbdf.sidn-pbdf.email.email": {
            "profile": True,
            "accepted_values": SENSITIVE_EMAIL_ALLOWLIST,
        }
    },
    user_txt="An email known to PubHubs",
    type=PubHubsSecuredRoomType.MESSAGES,
    room_id="!testroom:example.org",
    expiration_time_days="90",
)


class FakeUser:
    """Minimal mock of a matrix user returned by module_api.get_user_by_req."""

    class _UserID:
        def to_string(self):
            return "@authenticated_user:example.org"

    user = _UserID()


class FakeStore:
    def __init__(self, rooms=None):
        self._rooms = rooms or {}

    async def get_secured_room(self, room_id):
        return self._rooms.get(room_id)


class FakeModuleApi:
    """Authenticated module_api - get_user_by_req returns a real-looking user."""

    async def get_user_by_req(self, request):
        return FakeUser()


class FakeModuleApiUnauthenticated:
    """Module_api that simulates an unauthenticated request."""

    async def get_user_by_req(self, request):
        # Synapse raises this when there's no valid access token.
        raise SynapseError(401, "Missing access token")


class FakeRequest:
    """A minimal request stand-in.

    Only carries query args - the response is captured by patching
    respond_with_json, so we don't need to implement the rest of the
    twisted Request interface.
    """

    def __init__(self, room_id=None):
        self.args = {}
        if room_id is not None:
            self.args[b"room_id"] = [
                room_id.encode() if isinstance(room_id, str) else room_id
            ]


class ResponseCapture:
    """Replacement for synapse.http.server.respond_with_json.

    Patched into _secured_rooms_web and _validation for the duration of a
    test so the servlet code path runs end-to-end without touching twisted
    or synapse's response-writing machinery.
    """

    def __init__(self):
        self.code = None
        self.payload = None
        self.send_cors = None
        self.called = False

    def __call__(self, request, code, payload, send_cors=False, *args, **kwargs):
        self.called = True
        self.code = code
        self.payload = payload
        self.send_cors = send_cors

    @property
    def body_text(self):
        """Best-effort string view of the payload, for substring assertions."""
        if isinstance(self.payload, (bytes, bytearray)):
            return self.payload.decode("utf-8")
        if isinstance(self.payload, str):
            return self.payload
        return json.dumps(self.payload)

    @property
    def body_json(self):
        """The payload as a parsed dict.

        The servlet json.dumps()es its sanitised dict into a string, then
        passes that string to respond_with_json. So `payload` is usually a
        JSON-encoded string; parse once to get the structured form.
        """
        if isinstance(self.payload, str):
            return json.loads(self.payload)
        return self.payload


def make_servlet(rooms_dict, authenticated=True):
    api = FakeModuleApi() if authenticated else FakeModuleApiUnauthenticated()
    return SecuredRoomPublicMetadataServlet(FakeStore(rooms_dict), api)


async def call_endpoint(servlet, room_id):
    """Run the servlet's GET handler with respond_with_json patched out.

    Returns the ResponseCapture so assertions can read code + payload.
    """
    request = FakeRequest(room_id=room_id)
    capture = ResponseCapture()
    # The servlet's module and the validation decorator's module both call
    # respond_with_json by reference; patch both.
    with patch.object(_secured_rooms_web, "respond_with_json", capture):
        from pubhubs import _validation
        with patch.object(_validation, "respond_with_json", capture):
            await servlet._async_render_GET(request)
    return capture


class SecuredRoomPublicMetadataLeakTest(IsolatedAsyncioTestCase):
    """The core regression: accepted_values must never reach the response."""

    async def test_accepted_values_are_not_in_response_body(self):
        """The literal email addresses must not appear anywhere in the body.

        This is the primary regression test: if it fails, the leak is back.
        """
        servlet = make_servlet({"!testroom:example.org": ROOM_WITH_EMAIL_ALLOWLIST})

        response = await call_endpoint(servlet, "!testroom:example.org")

        self.assertEqual(response.code, 200)
        body = response.body_text
        for email in SENSITIVE_EMAIL_ALLOWLIST:
            self.assertNotIn(
                email,
                body,
                "Leaked email %r found in response body - security regression!" % email,
            )
        self.assertNotIn("accepted_values", body)

    async def test_accepted_contains_only_attribute_names(self):
        """`accepted` must be a list of attribute keys, not a dict with values."""
        servlet = make_servlet({"!testroom:example.org": ROOM_WITH_EMAIL_ALLOWLIST})

        response = await call_endpoint(servlet, "!testroom:example.org")

        payload = response.body_json
        self.assertIsInstance(payload["accepted"], list)
        self.assertEqual(payload["accepted"], ["pbdf.sidn-pbdf.email.email"])
        for entry in payload["accepted"]:
            self.assertIsInstance(entry, str)

    async def test_response_contains_only_whitelisted_fields(self):
        """Only the sanitised fields should appear - no unexpected leakage."""
        servlet = make_servlet({"!testroom:example.org": ROOM_WITH_EMAIL_ALLOWLIST})

        response = await call_endpoint(servlet, "!testroom:example.org")

        payload = response.body_json
        allowed_fields = {
            "room_id",
            "name",
            "topic",
            "expiration_time_days",
            "user_txt",
            "type",
            "accepted",
        }
        self.assertEqual(
            set(payload.keys()),
            allowed_fields,
            "Response contains unexpected fields: %s"
            % (set(payload.keys()) - allowed_fields),
        )


class SecuredRoomPublicMetadataBehaviourTest(IsolatedAsyncioTestCase):
    """Other contract guarantees of the endpoint."""

    async def test_returns_404_when_room_does_not_exist(self):
        servlet = make_servlet({})  # empty store - no rooms exist

        response = await call_endpoint(servlet, "!unknown:example.org")

        self.assertEqual(response.code, 404)

    async def test_returns_400_when_room_id_missing(self):
        servlet = make_servlet({"!testroom:example.org": ROOM_WITH_EMAIL_ALLOWLIST})

        response = await call_endpoint(servlet, None)  # no room_id query param

        self.assertEqual(response.code, 400)

    async def test_unauthenticated_request_is_rejected(self):
        """The @user_validator(USER) decorator must reject unauthenticated callers.

        Without this, the endpoint reverts to being a public PII leak.
        """
        servlet = make_servlet(
            {"!testroom:example.org": ROOM_WITH_EMAIL_ALLOWLIST},
            authenticated=False,
        )

        response = await call_endpoint(servlet, "!testroom:example.org")

        # The user_validator catches SynapseError(401) and responds with the
        # same status code. Either way the request must NOT be 200, and the
        # sensitive data must NOT have leaked.
        self.assertNotEqual(
            response.code,
            200,
            "Unauthenticated request was accepted - auth check has regressed!",
        )
        for email in SENSITIVE_EMAIL_ALLOWLIST:
            self.assertNotIn(email, response.body_text)
