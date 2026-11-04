"""Tests for modules/pubhubs/_push_gateway_proxy.py: only the app's encrypted blob leaves the hub."""

import sys
import unittest

sys.path.append("modules")
from pubhubs._push_gateway_proxy import gateway_response, push_request


def notify_body(devices, prio="low"):
    """A notify body as Synapse sends it for a pusher with `format: event_id_only`."""
    return {
        "notification": {
            "event_id": "$event",
            "room_id": "!room:hub",
            "counts": {"unread": 3},
            "prio": prio,
            "devices": devices,
        }
    }


def device(pushkey, blob=None):
    data = {"format": "event_id_only"}
    if blob is not None:
        data["blob"] = blob
    return {"app_id": "nl.pubhubs.client", "pushkey": pushkey, "pushkey_ts": 0, "data": data}


class PushRequestTest(unittest.TestCase):
    def test_only_the_blob_and_priority_go_out(self):
        pushes, pushkeys, without_blob = push_request(notify_body([device("key1", "BLOB")], prio="high"))
        self.assertEqual(pushes, [{"blob": "BLOB", "high_prio": True}])
        self.assertEqual(pushkeys, ["key1"])
        self.assertEqual(without_blob, [])

    def test_low_priority(self):
        pushes, _, _ = push_request(notify_body([device("key1", "BLOB")]))
        self.assertEqual(pushes, [{"blob": "BLOB", "high_prio": False}])

    def test_pushers_without_blob_are_rejected(self):
        # e.g. pushers from app builds that registered the device token itself
        body = notify_body([device("old"), device("key1", "BLOB")])
        pushes, pushkeys, without_blob = push_request(body)
        self.assertEqual(pushkeys, ["key1"])
        self.assertEqual(without_blob, ["old"])
        self.assertEqual(gateway_response({"Ok": {"rejected": [], "failed": []}}, pushkeys, without_blob),
                         (200, {"rejected": ["old"]}))


class GatewayResponseTest(unittest.TestCase):
    def test_rejected_indices_become_pushkeys(self):
        self.assertEqual(gateway_response({"Ok": {"rejected": [1]}}, ["a", "b"], []), (200, {"rejected": ["b"]}))

    def test_failed_or_errors_make_synapse_retry(self):
        self.assertEqual(gateway_response({"Ok": {"rejected": [], "failed": [0]}}, ["a"], [])[0], 502)
        self.assertEqual(gateway_response({"Err": "PleaseRetry"}, ["a"], [])[0], 502)

    def test_ignores_out_of_range_indices(self):
        self.assertEqual(gateway_response({"Ok": {"rejected": [5]}}, ["a"], []), (200, {"rejected": []}))


if __name__ == "__main__":
    unittest.main()
