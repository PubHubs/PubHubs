"""Tests for the room takeover, which lets a hub admin become room admin when the room's admins have left."""

import sys
from types import SimpleNamespace
from unittest import IsolatedAsyncioTestCase, TestCase

sys.path.append("modules")
from pubhubs._errors import ConflictError, NotFoundError
from synapse.api.errors import SynapseError

from pubhubs._room_takeover import _rooms_being_taken_over, find_granters, take_over_room
from pubhubs._spam_checker import SpamChecker

ROOM = "!room:hub"
HUB_ADMIN = "@hubadmin:hub"
FORMER_ADMIN = "@former:hub"
STEWARD = "@steward:hub"
REMOTE_ADMIN = "@admin:elsewhere"


def is_mine(user_id: str) -> bool:
    return user_id.endswith(":hub")


class FindGrantersTest(TestCase):
    def test_most_powerful_local_user_first(self):
        power_levels = {"users": {STEWARD: 50, FORMER_ADMIN: 100}}
        self.assertEqual(find_granters(power_levels, {STEWARD}, is_mine), [FORMER_ADMIN, STEWARD])

    def test_prefers_a_joined_user_at_the_same_level(self):
        power_levels = {"users": {FORMER_ADMIN: 100, "@other:hub": 100}}
        self.assertEqual(find_granters(power_levels, {"@other:hub"}, is_mine), ["@other:hub", FORMER_ADMIN])

    def test_skips_remote_users(self):
        power_levels = {"users": {REMOTE_ADMIN: 100, STEWARD: 50}}
        self.assertEqual(find_granters(power_levels, set(), is_mine), [STEWARD])

    def test_needs_the_power_to_change_power_levels(self):
        power_levels = {"users": {STEWARD: 50}, "events": {"m.room.power_levels": 100}}
        self.assertEqual(find_granters(power_levels, {STEWARD}, is_mine), [])

    def test_falls_back_to_state_default(self):
        power_levels = {"users": {STEWARD: 50}, "state_default": 75}
        self.assertEqual(find_granters(power_levels, {STEWARD}, is_mine), [])


class FakeSpamChecker:
    def __init__(self, calls):
        self.calls = calls

    def allow_join(self, user, room):
        self.calls.append(("allow_join", user))

    def revoke_join(self, user, room):
        self.calls.append(("revoke_join", user))


class FakeModuleApi:
    def __init__(self, power_levels: dict, joined: set[str], calls: list, fail_send: bool = False, cannot_join: frozenset = frozenset(), fail_leave: bool = False):
        self.power_levels = power_levels
        self.joined = joined
        self.calls = calls
        self.fail_send = fail_send
        self.cannot_join = cannot_join
        self.fail_leave = fail_leave

    async def get_room_state(self, room_id, event_filter):
        if self.power_levels is None:
            return {}
        state = {("m.room.power_levels", ""): SimpleNamespace(content=self.power_levels)}
        for user_id in self.joined:
            state[("m.room.member", user_id)] = SimpleNamespace(membership="join")
        state[("m.room.member", "@left:hub")] = SimpleNamespace(membership="leave")
        return state

    def is_mine(self, user_id):
        return is_mine(user_id)

    async def update_room_membership(self, sender, target, room_id, new_membership):
        self.calls.append((new_membership, sender))
        if new_membership == "join" and sender in self.cannot_join:
            raise SynapseError(403, "You are not invited to this room.")
        if new_membership == "leave" and self.fail_leave:
            raise RuntimeError("leave failed")

    async def create_and_send_event_into_room(self, event_dict):
        self.calls.append(("power_levels", event_dict["sender"], event_dict["content"]))
        if self.fail_send:
            raise RuntimeError("rejected")


class TakeOverRoomTest(IsolatedAsyncioTestCase):
    async def take_over(self, power_levels, joined, **kwargs):
        calls = []
        module_api = FakeModuleApi(power_levels, joined, calls, **kwargs)
        return await take_over_room(module_api, FakeSpamChecker(calls), ROOM, HUB_ADMIN), calls

    async def test_former_admin_rejoins_hands_over_and_leaves(self):
        power_levels = {"users": {FORMER_ADMIN: 100, STEWARD: 50}, "users_default": 0}
        level, calls = await self.take_over(power_levels, {STEWARD})

        self.assertEqual(level, 100)
        self.assertEqual(
            calls,
            [
                ("allow_join", FORMER_ADMIN),
                ("join", FORMER_ADMIN),
                ("revoke_join", FORMER_ADMIN),
                ("power_levels", FORMER_ADMIN, {"users": {FORMER_ADMIN: 100, STEWARD: 50, HUB_ADMIN: 100}, "users_default": 0}),
                ("leave", FORMER_ADMIN),
            ],
        )

    async def test_joined_admin_hands_over_without_rejoining(self):
        level, calls = await self.take_over({"users": {FORMER_ADMIN: 100}}, {FORMER_ADMIN})

        self.assertEqual(level, 100)
        self.assertEqual(calls, [("power_levels", FORMER_ADMIN, {"users": {FORMER_ADMIN: 100, HUB_ADMIN: 100}})])

    async def test_former_admin_leaves_again_when_the_power_levels_change_fails(self):
        calls = []
        module_api = FakeModuleApi({"users": {FORMER_ADMIN: 100}}, set(), calls, fail_send=True)
        with self.assertRaises(RuntimeError):
            await take_over_room(module_api, FakeSpamChecker(calls), ROOM, HUB_ADMIN)
        self.assertEqual(calls[-1], ("leave", FORMER_ADMIN))

    async def test_tries_the_next_granter_when_one_cannot_rejoin(self):
        power_levels = {"users": {FORMER_ADMIN: 100, "@other:hub": 100}}
        level, calls = await self.take_over(power_levels, set(), cannot_join=frozenset({"@other:hub"}))

        self.assertEqual(level, 100)
        self.assertEqual(
            calls,
            [
                ("allow_join", "@other:hub"),
                ("join", "@other:hub"),
                ("revoke_join", "@other:hub"),
                ("allow_join", FORMER_ADMIN),
                ("join", FORMER_ADMIN),
                ("revoke_join", FORMER_ADMIN),
                ("power_levels", FORMER_ADMIN, {"users": {FORMER_ADMIN: 100, "@other:hub": 100, HUB_ADMIN: 100}}),
                ("leave", FORMER_ADMIN),
            ],
        )

    async def test_conflict_when_nobody_can_rejoin(self):
        with self.assertRaises(ConflictError):
            await self.take_over({"users": {FORMER_ADMIN: 100}}, set(), cannot_join=frozenset({FORMER_ADMIN}))

    async def test_a_failed_leave_does_not_undo_the_takeover(self):
        level, calls = await self.take_over({"users": {FORMER_ADMIN: 100}}, set(), fail_leave=True)

        self.assertEqual(level, 100)
        self.assertEqual(calls[-1], ("leave", FORMER_ADMIN))

    async def test_a_steward_can_only_hand_over_steward(self):
        level, _ = await self.take_over({"users": {STEWARD: 50}}, {STEWARD})

        self.assertEqual(level, 50)

    async def test_one_takeover_of_a_room_at_a_time(self):
        _rooms_being_taken_over.add(ROOM)
        try:
            with self.assertRaises(ConflictError):
                await self.take_over({"users": {FORMER_ADMIN: 100}}, set())
        finally:
            _rooms_being_taken_over.discard(ROOM)

    async def test_the_room_is_released_after_a_takeover(self):
        with self.assertRaises(ConflictError):
            await self.take_over({"users": {}}, set())
        self.assertNotIn(ROOM, _rooms_being_taken_over)

    async def test_nothing_to_do_for_a_room_admin(self):
        level, calls = await self.take_over({"users": {HUB_ADMIN: 100}}, set())

        self.assertEqual(level, 100)
        self.assertEqual(calls, [])

    async def test_conflict_without_anyone_more_powerful(self):
        with self.assertRaises(ConflictError):
            await self.take_over({"users": {REMOTE_ADMIN: 100, HUB_ADMIN: 50}}, set())

    async def test_unknown_room(self):
        with self.assertRaises(NotFoundError):
            await self.take_over(None, set())


class FakeSecuredRoomStore:
    async def get_secured_room(self, room_id):
        return object()

    async def is_allowed(self, user_id, room_id):
        return False


class AllowJoinTest(IsolatedAsyncioTestCase):
    async def test_lets_a_former_admin_into_a_secured_room_only_while_allowed(self):
        spam_checker = SpamChecker(None, FakeSecuredRoomStore())
        self.assertFalse(await spam_checker.user_may_join_room(FORMER_ADMIN, ROOM, False))

        spam_checker.allow_join(FORMER_ADMIN, ROOM)
        self.assertTrue(await spam_checker.user_may_join_room(FORMER_ADMIN, ROOM, False))
        self.assertFalse(await spam_checker.user_may_join_room(STEWARD, ROOM, False))

        spam_checker.revoke_join(FORMER_ADMIN, ROOM)
        self.assertFalse(await spam_checker.user_may_join_room(FORMER_ADMIN, ROOM, False))
