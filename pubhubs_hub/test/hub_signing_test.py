"""Tests for modules/pubhubs/_hub_signing.py: the hub's signing key and its JWTs.

That Rust accepts these JWTs is checked by `python_hub_vector` in pubhubs/src/common/dsa.rs, with a
vector made by `make_rust_vector` below."""

import json
import os
import sys
import tempfile
import time
import unittest

sys.path.append("modules")
from pubhubs._base64url import b64url_decode
from pubhubs._hhpp import BESPOKE_ALG, parse_verifying_key, verify
from pubhubs._hub_signing import PHC_HUB_TICKET_REQ, HubSigningKey, load_or_create_key

RUST_VECTOR = os.path.join(os.path.dirname(__file__), "..", "..", "pubhubs", "src", "common", "dsa_python_vector.json")


def open_jwt(jwt, key):
    """The header and claims of `jwt`, checking its signature against `key`'s verifying key."""
    header, payload, signature = jwt.split(".")
    assert verify(f"{header}.{payload}".encode(), b64url_decode(signature), parse_verifying_key(key.verifying_key()), b"")
    return json.loads(b64url_decode(header)), json.loads(b64url_decode(payload))


def make_rust_vector():
    """Writes a new dsa_python_vector.json; run by hand when the format changes."""
    key = HubSigningKey.generate()
    vector = {
        "_comment": "Made by make_rust_vector in pubhubs_hub/test/hub_signing_test.py; checked by python_hub_vector in dsa.rs.",
        "signing_key": key.to_json(),
        "verifying_key": key.verifying_key(),
        "signed_ticket_req": key.sign_message({"handle": "testhub"}, PHC_HUB_TICKET_REQ, valid_for=100 * 365 * 24 * 3600),
    }
    with open(RUST_VECTOR, "w") as f:
        json.dump(vector, f, indent=2)


class HubSigningTest(unittest.TestCase):
    def test_signs_like_rust(self):
        key = HubSigningKey.generate()
        header, claims = open_jwt(key.sign_message({"handle": "testhub"}, PHC_HUB_TICKET_REQ, valid_for=60), key)
        self.assertEqual(header, {"alg": BESPOKE_ALG})
        self.assertEqual(claims["handle"], "testhub")
        self.assertEqual(claims["ph-mc"], PHC_HUB_TICKET_REQ)
        now = time.time()
        self.assertLess(claims["nbf"], now)
        self.assertGreater(claims["exp"], now)

    def test_rust_vector_key_matches(self):
        # The key in the vector Rust checks gives the same verifying key here as there.
        with open(RUST_VECTOR) as f:
            vector = json.load(f)
        self.assertEqual(HubSigningKey.from_json(vector["signing_key"]).verifying_key(), vector["verifying_key"])

    def test_key_is_kept(self):
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "key.json")
            first = load_or_create_key(path)
            self.assertEqual(os.stat(path).st_mode & 0o777, 0o600)
            self.assertEqual(load_or_create_key(path).verifying_key(), first.verifying_key())


if __name__ == "__main__":
    unittest.main()
