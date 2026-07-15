"""Tests for verify_hub_id_mac (modules/pubhubs/Core.py).

Locks the HMAC-SHA256 hub-id binding to a fixed vector shared with the Rust side
(api::hub::HubMacKey::mac), so the transcryptor's tag and the hub's check agree byte-for-byte.
"""

import sys
import unittest

# Import via the `pubhubs` package (as the sibling hub tests do); this pulls in synapse transitively,
# which CI installs from requirements.txt.
sys.path.append("modules")
from pubhubs.Core import verify_hub_id_mac

# Fixed vector, all unpadded base64url:
#   key    = 32 bytes of 0x01
#   hub id = 32 bytes of 0x02
#   tag    = HMAC-SHA256(key, hub_id)
KEY = "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE"
HUB_ID = "AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI"
TAG = "cyFAbgyID9kll4mL6zk68q6-1Rq1zfHVLlmR-a-t0t4"


class VerifyHubIdMacTest(unittest.TestCase):
    def test_accepts_matching_tag(self):
        self.assertTrue(verify_hub_id_mac(HUB_ID, KEY, TAG))

    def test_rejects_wrong_tag(self):
        # KEY decodes to a valid 32-byte value that is not the correct tag
        self.assertFalse(verify_hub_id_mac(HUB_ID, KEY, KEY))

    def test_rejects_wrong_own_id(self):
        # the tag was computed over HUB_ID, so checking it against a different own id must fail
        self.assertFalse(verify_hub_id_mac(KEY, KEY, TAG))


if __name__ == "__main__":
    unittest.main()
