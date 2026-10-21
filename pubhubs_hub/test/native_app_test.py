"""Tests for the native app origins a hub allows in CORS (modules/pubhubs/_native_app.py).
The vectors match hub-client/test/logic/nativeHubOrigin.test.ts, so both sides derive the same label."""

import sys
import unittest

sys.path.append("modules")
from pubhubs import _native_app
from pubhubs._hub_client_api_config import HubClientApiConfig

HUB_ID = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8"  # bytes 0..31
HOST = "aaaqeayeaudaocajbifqydiob4ibceqtcqkrmfyydenbwha5dypq.hubs.pubhubs-app.invalid"


class NativeAppTest(unittest.TestCase):
    def tearDown(self):
        _native_app.set_own_hub_id(None)

    def test_label_vectors(self):
        self.assertEqual(_native_app.native_hub_label(HUB_ID) + ".hubs.pubhubs-app.invalid", HOST)
        self.assertEqual(_native_app.native_hub_label("_" * 42 + "8"), "7" * 51 + "q")

    def test_origins(self):
        self.assertEqual(_native_app.native_hub_origins(HUB_ID), [f"https://{HOST}", f"capacitor://{HOST}"])

    def test_allowed_origins_follow_own_hub_id(self):
        config = HubClientApiConfig({"client_url": "https://client.example"}, None)
        self.assertEqual(config.allowed_origins, ["https://client.example"])

        _native_app.set_own_hub_id(HUB_ID)
        self.assertEqual(config.allowed_origins, ["https://client.example", f"https://{HOST}", f"capacitor://{HOST}"])


if __name__ == "__main__":
    unittest.main()
