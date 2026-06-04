from unittest import TestCase

import sys

sys.path.append("modules")
from pubhubs._HubMediaResource import (
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
