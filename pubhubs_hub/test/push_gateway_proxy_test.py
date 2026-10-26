"""Tests for the notification rewriting in modules/pubhubs/_push_gateway_proxy.py: every platform
gets the same content-free push, carrying only the hub id."""

import sys
import unittest

sys.path.append("modules")
from pubhubs._push_gateway_proxy import sanitize_notification

HUB_ID = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8"


def notify_body(app_id, prio="low"):
    """A notify body as Synapse sends it for a pusher with `format: event_id_only`."""
    return {
        "notification": {
            "event_id": "$event",
            "room_id": "!room:hub",
            "counts": {"unread": 3},
            "prio": prio,
            "devices": [{
                "app_id": app_id,
                "pushkey": "token",
                "pushkey_ts": 0,
                "data": {"format": "event_id_only", "default_payload": {"from": "client"}},
            }],
        }
    }


class SanitizeNotificationTest(unittest.TestCase):
    def test_strips_everything_but_event_id(self):
        notification = sanitize_notification(notify_body("nl.pubhubs.client.gplay"), HUB_ID)["notification"]
        self.assertEqual(set(notification), {"event_id", "prio", "devices"})
        self.assertEqual(notification["event_id"], "$event")

    def test_every_platform_gets_the_hub_id(self):
        for app_id in ("nl.pubhubs.client.ios", "nl.pubhubs.client.gplay", "nl.pubhubs.client.fdroid"):
            device = sanitize_notification(notify_body(app_id), HUB_ID)["notification"]["devices"][0]
            self.assertEqual(device["data"]["default_payload"]["hub_id"], HUB_ID)
            # Whatever the client put in default_payload is replaced, not merged.
            self.assertNotIn("from", device["data"]["default_payload"])
            self.assertEqual(device["data"]["format"], "event_id_only")
            self.assertEqual(device["pushkey"], "token")

    def test_apns_gets_generic_alert_and_high_priority(self):
        notification = sanitize_notification(notify_body("nl.pubhubs.client.ios", prio="low"), HUB_ID)["notification"]
        self.assertEqual(notification["prio"], "high")
        aps = notification["devices"][0]["data"]["default_payload"]["aps"]
        self.assertEqual(aps["alert"], {"title-loc-key": "push_notification_title", "loc-key": "push_notification_body"})
        self.assertNotIn("content-available", aps)

    def test_android_keeps_synapse_priority_and_gets_no_aps(self):
        for prio in ("low", "high"):
            notification = sanitize_notification(notify_body("nl.pubhubs.client.gplay", prio=prio), HUB_ID)["notification"]
            self.assertEqual(notification["prio"], prio)
            self.assertNotIn("aps", notification["devices"][0]["data"]["default_payload"])


if __name__ == "__main__":
    unittest.main()
