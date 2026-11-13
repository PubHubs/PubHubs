"""Tests for get_user_power_level, the single power level lookup used by the hub modules."""

import sys
from unittest import TestCase

sys.path.append("modules")
from pubhubs._validation import get_user_power_level


class GetUserPowerLevelTest(TestCase):
    def test_explicit_entry(self):
        self.assertEqual(get_user_power_level("@a:x", {"users": {"@a:x": 50}, "users_default": 25}), 50)

    def test_explicit_zero_wins_over_users_default(self):
        self.assertEqual(get_user_power_level("@a:x", {"users": {"@a:x": 0}, "users_default": 25}), 0)

    def test_falls_back_to_users_default(self):
        self.assertEqual(get_user_power_level("@a:x", {"users": {"@b:x": 100}, "users_default": 25}), 25)

    def test_falls_back_to_zero(self):
        self.assertEqual(get_user_power_level("@a:x", {}), 0)
