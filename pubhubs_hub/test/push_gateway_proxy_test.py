"""Tests for modules/pubhubs/_push_gateway_proxy.py: only the app's encrypted blob leaves the hub."""

import sys
import unittest

sys.path.append("modules")
from pubhubs import _push_gateway_proxy
import asyncio

from pubhubs._push_gateway_proxy import APP_ID, gateway_response, only_registered, push_request, registered_blobs


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
    def test_only_the_blob_goes_out(self):
        # Not even the priority: Synapse sets it per event, so it says something about the message.
        pushes, pushkeys, without_blob = push_request(notify_body([device("key1", "BLOB")], prio="high"))
        self.assertEqual(pushes, [{"blob": "BLOB"}])
        self.assertEqual(pushkeys, ["key1"])
        self.assertEqual(without_blob, [])

    def test_pushers_without_blob_are_rejected(self):
        # e.g. pushers from app builds that registered the device token itself
        body = notify_body([device("old"), device("key1", "BLOB")])
        pushes, pushkeys, without_blob = push_request(body)
        self.assertEqual(pushkeys, ["key1"])
        self.assertEqual(without_blob, ["old"])
        self.assertEqual(gateway_response(success(rejected=[], failed=[]), pushkeys, without_blob),
                         (200, {"rejected": ["old"]}))


class OnlyRegisteredTest(unittest.TestCase):
    def test_made_up_blobs_are_dropped(self):
        # The gateway's url and PHC's blob key are public: anyone can post a notify body.
        pushes = [{"blob": "REAL"}, {"blob": "FORGED"}, {"blob": "X"}]
        kept, kept_keys, unknown = only_registered(pushes, ["k1", "k1", "nokey"], {("k1", "REAL")})
        self.assertEqual(kept, [{"blob": "REAL"}])
        self.assertEqual(kept_keys, ["k1"])
        self.assertEqual(unknown, ["k1", "nokey"])


class FakeTxn:
    def __init__(self, rows):
        self.rows = rows
        self.executed = None

    def execute(self, sql, args):
        self.executed = (sql, args)

    def fetchall(self):
        return self.rows


class FakeModuleApi:
    def __init__(self, rows):
        self.txn = FakeTxn(rows)

    async def run_db_interaction(self, desc, fn, *args):
        return fn(self.txn, *args)


class RegisteredBlobsTest(unittest.TestCase):
    def test_reads_blobs_from_pusher_data(self):
        api = FakeModuleApi([
            ("k1", '{"url": "u", "blob": "B1"}'),
            ("k2", b'{"blob": "B2"}'),
            ("k3", "not json"),
            ("k4", '{"url": "u"}'),
        ])
        found = asyncio.run(registered_blobs(api, ["k1", "k2", "k3", "k4", None]))
        self.assertEqual(found, {("k1", "B1"), ("k2", "B2")})
        sql, args = api.txn.executed
        self.assertEqual(args[0], APP_ID)
        self.assertEqual(sorted(args[1:]), ["k1", "k2", "k3", "k4"])
        self.assertEqual(sql.count("?"), 5)

    def test_no_query_without_pushkeys(self):
        api = FakeModuleApi([])
        self.assertEqual(asyncio.run(registered_blobs(api, [])), set())
        self.assertIsNone(api.txn.executed)


def success(**result):
    return {"Ok": {"Success": result}}


class GatewayResponseTest(unittest.TestCase):
    def test_rejected_indices_become_pushkeys(self):
        self.assertEqual(gateway_response(success(rejected=[1]), ["a", "b"], []), (200, {"rejected": ["b"]}))

    def test_failed_or_errors_make_synapse_retry(self):
        self.assertEqual(gateway_response(success(rejected=[], failed=[0]), ["a"], [])[0], 502)
        self.assertEqual(gateway_response({"Err": "PleaseRetry"}, ["a"], [])[0], 502)
        self.assertEqual(gateway_response({"Ok": "TooManyPushes"}, ["a"], [])[0], 502)

    def test_new_ticket_is_fetched_next_time(self):
        class Tickets:
            forgotten = False

            def forget_ticket(self):
                self.forgotten = True

        tickets = Tickets()
        _push_gateway_proxy.set_hub_tickets(tickets)
        try:
            self.assertEqual(gateway_response({"Ok": "RetryWithNewTicket"}, ["a"], [])[0], 502)
            self.assertTrue(tickets.forgotten)
        finally:
            _push_gateway_proxy.set_hub_tickets(None)

    def test_ignores_out_of_range_indices(self):
        self.assertEqual(gateway_response(success(rejected=[5]), ["a"], []), (200, {"rejected": []}))


if __name__ == "__main__":
    unittest.main()
