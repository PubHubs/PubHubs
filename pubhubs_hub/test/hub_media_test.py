from unittest import IsolatedAsyncioTestCase, TestCase

import sys
import tempfile
from types import SimpleNamespace

sys.path.append("modules")
from pubhubs._cors import set_public_allow_origin_header
from pubhubs._hub_media_resource import (
    HubMediaResource,
    ALLOWED_HUB_MEDIA_TYPES,
    MAX_HUB_MEDIA_SIZE,
)


class HubMediaContentTypeTest(TestCase):
    """Tests for the content-type detection used when serving and validating
    hub media (icon/banner). This is the logic that previously caused PNG/JPEG
    uploads to be served as text/html because no Content-Type was set."""

    def setUp(self):
        # _detect_content_type does not rely on instance state, so we can avoid
        # the heavy DirectServeJsonResource constructor (which sets up child
        # resources) by creating a bare instance.
        self.resource = HubMediaResource.__new__(HubMediaResource)

    def detect(self, content: bytes) -> str:
        return self.resource._detect_content_type(content).decode()

    def test_detects_png(self):
        png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
        self.assertEqual(self.detect(png), "image/png")

    def test_detects_jpeg_jfif(self):
        jpeg = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00"
        self.assertEqual(self.detect(jpeg), "image/jpeg")

    def test_detects_jpeg_exif(self):
        jpeg = b"\xff\xd8\xff\xe1\x00\x10Exif\x00"
        self.assertEqual(self.detect(jpeg), "image/jpeg")

    def test_detects_svg_with_xml_declaration(self):
        svg = b'<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="x"></svg>'
        self.assertEqual(self.detect(svg), "image/svg+xml")

    def test_detects_svg_without_xml_declaration(self):
        svg = b'<svg xmlns="http://www.w3.org/2000/svg"></svg>'
        self.assertEqual(self.detect(svg), "image/svg+xml")

    def test_detects_svg_with_leading_whitespace(self):
        svg = b"   \n\t<svg></svg>"
        self.assertEqual(self.detect(svg), "image/svg+xml")

    def test_detects_svg_after_leading_comment(self):
        svg = b"<!-- generated -->\n<svg></svg>"
        self.assertEqual(self.detect(svg), "image/svg+xml")

    def test_unsupported_type_falls_back_to_octet_stream(self):
        # e.g. a GIF, which is not in ALLOWED_HUB_MEDIA_TYPES
        gif = b"GIF89a" + b"\x00" * 16
        self.assertEqual(self.detect(gif), "application/octet-stream")

    def test_plain_text_falls_back_to_octet_stream(self):
        self.assertEqual(self.detect(b"just some text"), "application/octet-stream")

    def test_empty_content_falls_back_to_octet_stream(self):
        self.assertEqual(self.detect(b""), "application/octet-stream")

    def test_every_detectable_image_type_is_allowed(self):
        # Any type the detector recognises (other than the fallback) must be an
        # accepted upload type, otherwise GET would serve files that POST rejects.
        for content in (
            b"\x89PNG\r\n\x1a\n",
            b"\xff\xd8\xff\xe0",
            b"<svg></svg>",
        ):
            detected = self.resource._detect_content_type(content).decode()
            self.assertIn(detected, ALLOWED_HUB_MEDIA_TYPES)


class HubMediaConstantsTest(TestCase):
    def test_allowed_types_cover_png_jpeg_svg(self):
        for mime in ("image/png", "image/jpeg", "image/svg+xml"):
            self.assertIn(mime, ALLOWED_HUB_MEDIA_TYPES)

    def test_max_media_size_is_five_mb(self):
        self.assertEqual(MAX_HUB_MEDIA_SIZE, 5_000_000)


class _FakeRequest:
    """Minimal stand-in for SynapseRequest: records headers and the written body."""

    def __init__(self):
        self.headers = {}
        self.written = b""
        self.finished = False

    def setHeader(self, name, value):
        self.headers[name] = value

    def write(self, content):
        self.written += content

    def finish(self):
        self.finished = True


class PublicAllowOriginHeaderTest(TestCase):
    def test_sets_wildcard_without_consulting_the_request_origin(self):
        request = _FakeRequest()

        set_public_allow_origin_header(request)

        self.assertEqual(request.headers[b"Access-Control-Allow-Origin"], b"*")


class HubMediaCorsTest(IsolatedAsyncioTestCase):
    """The clients read hub media with fetch() rather than binding it to <img src>, so the native
    shell's https origin cannot auto-upgrade the plain-HTTP dev address (see hub-client's
    useImageObjectUrl). Unlike <img>, fetch() needs the response to be CORS-readable, and this GET
    writes raw bytes instead of going through respond_with_json, so Synapse's own CORS handling
    never runs for it."""

    def _resource(self, media_path):
        # _async_render_GET needs no module_api (its validator is GUEST, i.e. unauthenticated), so
        # skip the heavy DirectServeJsonResource constructor as the tests above do.
        resource = HubMediaResource.__new__(HubMediaResource)
        resource._media_type = "icon"
        resource._is_default = False
        resource._darkmode = False
        resource._get_media_path = lambda: media_path
        return resource

    async def test_get_allows_any_origin(self):
        png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
        with tempfile.NamedTemporaryFile() as fd:
            fd.write(png)
            fd.flush()
            request = _FakeRequest()

            await self._resource(fd.name)._async_render_GET(request)

        self.assertEqual(request.headers[b"Access-Control-Allow-Origin"], b"*")
        self.assertEqual(request.headers[b"Content-Type"], b"image/png")
        self.assertEqual(request.written, png)
        self.assertTrue(request.finished)

    async def test_get_allows_any_origin_when_falling_back_to_default_media(self):
        # The default-media branch responds on its own, so it has to carry the header too.
        svg = b"<svg></svg>"
        with tempfile.NamedTemporaryFile() as fd:
            fd.write(svg)
            fd.flush()
            resource = self._resource("/nonexistent/hub/icon")
            resource._config = SimpleNamespace(
                default_hub_icon_path=fd.name,
                default_hub_icon_dark_path=fd.name,
            )
            request = _FakeRequest()

            await resource._async_render_GET(request)

        self.assertEqual(request.headers[b"Access-Control-Allow-Origin"], b"*")
        self.assertEqual(request.headers[b"Content-Type"], b"image/svg+xml")
        self.assertEqual(request.written, svg)
