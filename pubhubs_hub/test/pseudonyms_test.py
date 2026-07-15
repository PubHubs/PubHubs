import os
import subprocess
import sys
import unittest
from unittest import IsolatedAsyncioTestCase
from unittest.mock import patch

from synapse.api.errors import Codes, SynapseError
from synapse.module_api import ModuleApi

sys.path.append("modules")
from pseudonyms import Pseudonym, PseudonymHelper, register_under_fresh_pseudonym


class TestPseudonymHelper(unittest.TestCase):
    def test_checkdigit(self):
        self.assertEqual(PseudonymHelper.checkdigit("000"), "0")
        self.assertEqual(PseudonymHelper.checkdigit("1"), "f")
        self.assertEqual(PseudonymHelper.checkdigit("10"), "e")
        self.assertEqual(PseudonymHelper.checkdigit("20"), "b")
        self.assertEqual(PseudonymHelper.checkdigit("8"), "1")

        # taking the inverse of the weight for the i-th digit,
        # we should get 15 times -1
        self.assertEqual(
            PseudonymHelper.checkdigit_alphabet[-15 % 17],
            PseudonymHelper.checkdigit(
                "".join(
                    [
                        PseudonymHelper.checkdigit_alphabet[pow(16 - i, -1, 17)]
                        for i in range(0, 15)
                    ]
                )
            ),
        )

        # all ones will give the sum -2 - 3 - 4 - ... - 16
        self.assertEqual(
            PseudonymHelper.checkdigit_alphabet[(1 - 17 * 16 // 2) % 17],
            PseudonymHelper.checkdigit(15 * "1"),
        )

    def test_short_pseudonums(self):
        self.assertEqual(
            list(PseudonymHelper.short_pseudonyms("0123456789" * 6 + "abcd")),
            [
                "01f-6cd",
                "012a-dbcd",
                "01231-eabcd",
                "012344-b9abcd",
                "0123451-689abcd",
                "01234568-1789abcd",
                "012345677-f6789abcd",
                "012345678e-g56789abcd",
                "0123456789b-6456789abcd",
                "012345678900-43456789abcd",
                "0123456789014-c23456789abcd",
                "01234567890125-f123456789abcd",
                "012345678901232-f0123456789abcd",
                "012345678901234b-790123456789abcd",
            ],
        )


class TestRegisterUnderFreshPseudonym(IsolatedAsyncioTestCase):
    # a valid 64-char local pseudonym; its 14 short pseudonyms are listed in test_short_pseudonums
    LOCAL_PSEUDONYM = "0123456789" * 6 + "abcd"

    def _register_user_rejecting(self, taken):
        """A fake register_user that raises USER_IN_USE for any localpart in `taken`, otherwise
        returns a mxid built from it; records every attempt in self.attempts."""
        self.attempts = []

        async def register_user(localpart):
            self.attempts.append(localpart)
            if localpart in taken:
                raise SynapseError(400, "User ID already taken.", Codes.USER_IN_USE)
            return f"@{localpart}:hub"

        return register_user

    async def test_uses_first_free_pseudonym(self):
        mxid = await register_under_fresh_pseudonym(
            self.LOCAL_PSEUDONYM, self._register_user_rejecting(set())
        )
        self.assertEqual(len(self.attempts), 1)
        self.assertEqual(mxid, f"@{self.attempts[0]}:hub")

    async def test_retries_past_taken_pseudonyms(self):
        # the first two short pseudonyms are already taken; registration must skip to the third.
        # Regression test: the old code did `length += 1` on collision — an UnboundLocalError — so a
        # single collision aborted registration with a 500 instead of trying the next pseudonym.
        candidates = list(PseudonymHelper.short_pseudonyms(self.LOCAL_PSEUDONYM))
        mxid = await register_under_fresh_pseudonym(
            self.LOCAL_PSEUDONYM, self._register_user_rejecting(set(candidates[:2]))
        )
        self.assertEqual(self.attempts, candidates[:3])
        self.assertEqual(mxid, f"@{candidates[2]}:hub")

    async def test_non_collision_error_propagates(self):
        async def register_user(localpart):
            raise SynapseError(403, "forbidden", Codes.FORBIDDEN)

        with self.assertRaises(SynapseError):
            await register_under_fresh_pseudonym(self.LOCAL_PSEUDONYM, register_user)

    async def test_all_taken_raises_runtime_error(self):
        candidates = list(PseudonymHelper.short_pseudonyms(self.LOCAL_PSEUDONYM))
        with self.assertRaises(RuntimeError):
            await register_under_fresh_pseudonym(
                self.LOCAL_PSEUDONYM, self._register_user_rejecting(set(candidates))
            )
        self.assertEqual(self.attempts, candidates)  # exhausted every short pseudonym


if __name__ == "__main__":
    unittest.main()
