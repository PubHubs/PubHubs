"""Tests that an expired Yivi disclosure no longer grants access to a secured room.

`allowed_to_join_room` rows are kept after expiry (they drive the "you were removed from
a secured room" notification), so `is_allowed` — and therefore the `user_may_join_room`
spam-checker hook — has to look at `user_expired` and not just at the row's existence.
"""

import sqlite3
import time
from unittest import IsolatedAsyncioTestCase

import sys

from synapse.storage.engines import Sqlite3Engine

sys.path.append("modules")
from pubhubs._store import HubStore
from pubhubs._spam_checker import SpamChecker
from pubhubs._secured_rooms_class import SecuredRoom, PubHubsSecuredRoomType

USER = "@user:domain"
ROOM = "!secured:domain"
EXPIRATION_TIME_DAYS = 182


class FakeTransaction:
    """A sqlite3 cursor plus the `database_engine` HubStore branches on for dialect-specific SQL."""

    # Bypasses __init__, which needs a full Synapse database config; isinstance is all HubStore uses.
    database_engine = Sqlite3Engine.__new__(Sqlite3Engine)

    def __init__(self, cursor):
        self._cursor = cursor

    def __getattr__(self, name):
        return getattr(self._cursor, name)


class SqliteModuleApi:
    """Runs HubStore's transactions against an in-memory sqlite database."""

    def __init__(self):
        self.connection = sqlite3.connect(":memory:")
        self.membership_calls = []

    async def run_db_interaction(self, desc, func, *args, **kwargs):
        cursor = self.connection.cursor()
        try:
            result = func(FakeTransaction(cursor), *args, **kwargs)
            self.connection.commit()
            return result
        finally:
            cursor.close()

    async def update_room_membership(self, action_user, user, room, membership):
        """Records the call and, like Synapse, refuses to make a non-member leave."""

        self.membership_calls.append((user, room, membership))

        joined = self.connection.execute(
            "SELECT 1 FROM local_current_membership WHERE user_id = ? AND room_id = ? AND membership = 'join'",
            (user, room),
        ).fetchone()
        if not joined:
            raise Exception(f"{user} not in room {room}")

        self.connection.execute(
            "DELETE FROM local_current_membership WHERE user_id = ? AND room_id = ?",
            (user, room),
        )
        self.connection.commit()


class TestExpiredAccess(IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.api = SqliteModuleApi()
        self.store = HubStore(self.api, {})
        await self.store.create_tables()

        self.api.connection.executescript(
            f"""
            -- Columns that DBMigration adds to the tables created by create_tables().
            ALTER TABLE allowed_to_join_room ADD COLUMN join_time TEXT NOT NULL DEFAULT 0;
            ALTER TABLE allowed_to_join_room ADD COLUMN user_expired INT NOT NULL DEFAULT 0;
            ALTER TABLE secured_rooms ADD COLUMN expiration_time_days TEXT NOT NULL DEFAULT {EXPIRATION_TIME_DAYS};

            -- Synapse's own tables: room_stats_state is what get_secured_room joins against
            -- for name/topic/type, local_current_membership what the expiry sweep checks
            -- before kicking.
            CREATE TABLE room_stats_state(room_id TEXT, name TEXT, topic TEXT, room_type TEXT);
            INSERT INTO room_stats_state VALUES ('{ROOM}', 'secured', 'secured', '{PubHubsSecuredRoomType.MESSAGES.value}');

            CREATE TABLE local_current_membership(room_id TEXT, user_id TEXT, event_id TEXT, membership TEXT);
            """
        )
        await self.store.create_secured_room(
            SecuredRoom(
                name="secured",
                topic="secured",
                accepted={"something": {"profile": True, "accepted_values": ["a requirement"]}},
                user_txt="",
                type=PubHubsSecuredRoomType.MESSAGES,
                room_id=ROOM,
                expiration_time_days=EXPIRATION_TIME_DAYS,
            )
        )

    def _expire(self):
        self.api.connection.execute(
            "UPDATE allowed_to_join_room SET user_expired = 1 WHERE user_id = ? AND room_id = ?",
            (USER, ROOM),
        )
        self.api.connection.commit()

    def _join(self, user_id=USER, room_id=ROOM):
        self.api.connection.execute(
            "INSERT INTO local_current_membership VALUES (?, ?, '$event', 'join')",
            (room_id, user_id),
        )
        self.api.connection.commit()

    async def _allow_stale(self, user_id=USER, room_id=ROOM):
        """Grant access with a join_time past the room's expiration_time_days."""

        stale = time.time() - ((EXPIRATION_TIME_DAYS + 1) * 24 * 60 * 60)
        await self.store.allow(user_id, room_id, stale)

    async def test_is_allowed_after_disclosure(self):
        await self.store.allow(USER, ROOM, time.time())

        self.assertTrue(await self.store.is_allowed(USER, ROOM))

    async def test_not_allowed_once_expired(self):
        await self.store.allow(USER, ROOM, time.time())
        self._expire()

        self.assertFalse(await self.store.is_allowed(USER, ROOM))

    async def test_allowed_again_after_new_disclosure(self):
        await self.store.allow(USER, ROOM, time.time())
        self._expire()

        # Disclosing again renews access and clears the expiry.
        await self.store.allow(USER, ROOM, time.time())

        self.assertTrue(await self.store.is_allowed(USER, ROOM))

    async def test_spam_checker_blocks_expired_user(self):
        checker = SpamChecker(self.api, self.store)
        await self.store.allow(USER, ROOM, time.time())

        self.assertTrue(await checker.user_may_join_room(USER, ROOM, False))

        self._expire()

        self.assertFalse(await checker.user_may_join_room(USER, ROOM, False))

    async def test_expiry_sweep_blocks_stale_access(self):
        await self._allow_stale()

        await self.store.remove_from_room()

        self.assertFalse(await self.store.is_allowed(USER, ROOM))

    async def test_expiry_sweep_kicks_joined_user(self):
        await self._allow_stale()
        self._join()

        await self.store.remove_from_room()

        self.assertEqual(self.api.membership_calls, [(USER, ROOM, "leave")])

    async def test_expiry_sweep_kicks_expired_user_only_once(self):
        """A kicked user's row stays behind; the next sweep must not try to kick them again.

        `update_room_membership` raises for a user who is not in the room, which used to
        abort the whole sweep and leave the rows after it unhandled.
        """

        await self._allow_stale()
        self._join()

        await self.store.remove_from_room()
        self.api.membership_calls.clear()

        await self.store.remove_from_room()

        self.assertEqual(self.api.membership_calls, [])

    async def test_expiry_sweep_skips_user_who_already_left(self):
        # Access expired, but the user left of their own accord before the sweep ran.
        await self._allow_stale()

        await self.store.remove_from_room()

        self.assertEqual(self.api.membership_calls, [])
        self.assertFalse(await self.store.is_allowed(USER, ROOM))

    async def test_expiry_sweep_retries_user_still_in_room(self):
        # Marked expired by an earlier sweep whose kick failed: still joined, so retry it.
        await self._allow_stale()
        self._join()
        self._expire()

        await self.store.remove_from_room()

        self.assertEqual(self.api.membership_calls, [(USER, ROOM, "leave")])

    async def test_remove_users_from_secured_room_leaves_other_rooms_alone(self):
        """Emptying one room must not kick users out of another, even expired ones.

        Expiring the other room's stale access is the daily sweep's job.
        """

        other_room = "!other:domain"
        self.api.connection.executescript(
            f"""
            INSERT INTO room_stats_state VALUES ('{other_room}', 'other', 'other', '{PubHubsSecuredRoomType.MESSAGES.value}');
            INSERT INTO secured_rooms(room_id, accepted, user_txt, expiration_time_days)
                VALUES ('{other_room}', '{{}}', '', {EXPIRATION_TIME_DAYS});
            """
        )
        await self.store.allow(USER, ROOM, time.time())
        await self._allow_stale(room_id=other_room)
        self._join(room_id=ROOM)
        self._join(room_id=other_room)

        await self.store.remove_users_from_secured_room(ROOM)

        self.assertEqual(self.api.membership_calls, [(USER, ROOM, "leave")])
        self.assertTrue(await self.store.is_allowed(USER, other_room))
