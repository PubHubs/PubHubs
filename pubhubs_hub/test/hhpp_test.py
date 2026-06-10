"""Tests for composite ML-DSA-65 + Ed25519 HHPP verification (modules/pubhubs/_hhpp.py).

These drive the public entry point check_hhpp, which parses the JWT envelope, verifies the composite
signature, validates the claims (message code, exp/nbf), and routes constellation (mis)matches to an
HhppStatus.  The composite-signature primitive `verify` is additionally checked on its own against
official and cross-implementation vectors:

  - STANDARD scheme against the official IETF test vector
    (lamps-wg/draft-composite-sigs, id-MLDSA65-Ed25519-SHA512).
  - BESPOKE scheme (the interim empty-ML-DSA-context variant; no official vector exists) against a
    vector the Rust backend produced (src/common/dsa.rs::tests::emit_bespoke_test_vector), confirming
    pyca/cryptography verifies an aws-lc-rs signature with an empty context.

Fixtures live in test/fixtures/.  Regenerate the bespoke one with:
  cargo test --lib dsa::tests::emit_bespoke_test_vector -- --ignored --nocapture
"""

import base64
import hashlib
import json
import os
import sys
import time
import unittest

# Import via the `pubhubs` package (as the sibling hub tests do) so _hhpp's relative imports resolve;
# this pulls in synapse transitively, which CI installs from requirements.txt.
sys.path.append("modules")
from pubhubs._hhpp import (
    BESPOKE_ALG,
    STANDARD_ALG,
    CompositeKey,
    HhppStatus,
    check_hhpp,
    parse_verifying_key,
    verify,
    _ALG_CONTEXTS,
    _HHPP_MESSAGE_CODE,
    _LABEL,
    _LEEWAY_SECONDS,
    _MAX_HHPP_LEN,
    _PREFIX,
)
from pubhubs._base64url import b64url_decode, b64url_encode

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.asymmetric.mldsa import MLDSA65PrivateKey

_FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")

# A signing key pair and the matching constellation, shared by every check_hhpp test below.
_ML = MLDSA65PrivateKey.generate()
_ED = Ed25519PrivateKey.generate()
_KEY = CompositeKey(ed=_ED.public_key(), ml=_ML.public_key())
_CONSTELLATION = {"created_at": 1000, "id": "our-id"}


def _load_fixture(name):
    with open(os.path.join(_FIXTURES, name)) as f:
        return json.load(f)


def _mint_token(payload_bytes, alg=STANDARD_ALG):
    """A JWT with a *valid* composite signature (by _ML/_ED) over the given raw payload bytes,
    mirroring _hhpp.verify: M' over PREFIX‖LABEL‖len(ctx)‖ctx‖SHA-512(signing_input), with the ML-DSA
    primitive fed the alg's context (empty for bespoke, the Label for standard)."""
    header_b64 = b64url_encode(json.dumps({"alg": alg}).encode())
    payload_b64 = b64url_encode(payload_bytes)
    signing_input = (header_b64 + "." + payload_b64).encode("ascii")
    m_prime = _PREFIX + _LABEL + bytes([0]) + hashlib.sha512(signing_input).digest()  # len(ctx)=0, empty
    sig = _ML.sign(m_prime, _ALG_CONTEXTS[alg]) + _ED.sign(m_prime)
    return f"{header_b64}.{payload_b64}.{b64url_encode(sig)}"


def _mint(claims, alg=STANDARD_ALG):
    return _mint_token(json.dumps(claims).encode(), alg)


def _bad_sig_token(claims):
    """A well-formed JWT whose signature is bogus (wrong length, so `verify` fails), reaching
    check_hhpp's signature-failure path."""
    header_b64 = b64url_encode(json.dumps({"alg": STANDARD_ALG}).encode())
    payload_b64 = b64url_encode(json.dumps(claims).encode())
    return f"{header_b64}.{payload_b64}.{b64url_encode(b'bogus signature')}"


def _hhpp_claims(code=_HHPP_MESSAGE_CODE, ci="coincide", **extra):
    """A valid HHPP claims dict: message `code` plus a `ci` (ph-ci), plus any extra claims (exp/nbf,
    ...).  `code` or `ci` set to None drops that claim; `ci` defaults to one coinciding with
    _CONSTELLATION, or pass a custom value."""
    claims = dict(extra)
    if code is not None:
        claims["ph-mc"] = code
    if ci == "coincide":
        claims["ph-ci"] = {"c": _CONSTELLATION["created_at"], "i": _CONSTELLATION["id"]}
    elif ci is not None:
        claims["ph-ci"] = ci
    return claims


def _check(claims, alg=STANDARD_ALG):
    """Mint a validly-signed HHPP over `claims` and open it against the shared key/constellation."""
    return check_hhpp(_mint(claims, alg), _KEY, _CONSTELLATION)


class TestStandardScheme(unittest.TestCase):
    """The standard ML-DSA-65-Ed25519 scheme (ML-DSA context = the Label), against the official
    IETF vector — `verify` exercised directly."""

    def setUp(self):
        v = _load_fixture("composite_standard_vector.json")
        self.m = base64.b64decode(v["m_b64"])
        self.sig = base64.b64decode(v["sig_b64"])
        pk = base64.b64decode(v["pk_b64"])  # ML-DSA-65 pub (1952) ‖ ed25519 pub (32)
        self.key = parse_verifying_key(
            {
                "ml": base64.b64encode(pk[:1952]).decode(),
                "ed": base64.b64encode(pk[1952:]).decode(),
            }
        )

    def test_official_vector_verifies(self):
        # The standard scheme passes the Label as the ML-DSA context.
        self.assertTrue(verify(self.m, self.sig, self.key, _LABEL))

    def test_empty_context_rejected(self):
        # Verifying with the bespoke (empty) ML-DSA context must fail on a standard signature.
        self.assertFalse(verify(self.m, self.sig, self.key, b""))

    def test_tampered_halves_rejected(self):
        for i in (0, len(self.sig) - 1):  # a byte in the ML-DSA half, and in the ed25519 half
            tampered = bytearray(self.sig)
            tampered[i] ^= 1
            self.assertFalse(verify(self.m, bytes(tampered), self.key, _LABEL))


class TestBespokeScheme(unittest.TestCase):
    """The interim ph-ML-DSA-65-Ed25519 scheme (empty ML-DSA context), against a vector produced by
    the Rust backend — a cross-implementation check (aws-lc-rs signer, pyca verifier)."""

    def setUp(self):
        self.v = _load_fixture("composite_bespoke_vector.json")
        self.key = parse_verifying_key(self.v["verifying_key"])
        self.assertEqual(self.v["alg"], BESPOKE_ALG)

    def test_raw_verify(self):
        header_b64, payload_b64, sig_b64 = self.v["jws"].split(".")
        signing_input = (header_b64 + "." + payload_b64).encode("ascii")
        sig = b64url_decode(sig_b64)
        self.assertTrue(verify(signing_input, sig, self.key, b""))
        # the standard (Label) context must NOT verify a bespoke signature
        self.assertFalse(verify(signing_input, sig, self.key, _LABEL))


class TestCheckHhppEnvelope(unittest.TestCase):
    """The hand-rolled JWT parsing: structural profile and fail-closed rejections, all the sender's
    fault → OTHERWISE_INVALID.  (These short-circuit before the signature check, so the key only has
    to be non-None.)"""

    def _status(self, token):
        return check_hhpp(token, _KEY, _CONSTELLATION).status

    def test_non_string_token_rejected(self):
        for token in (None, 123, b"bytes"):
            self.assertIs(self._status(token), HhppStatus.OTHERWISE_INVALID)

    def test_wrong_segment_count_rejected(self):
        for token in ("aaa.bbb", "aaa.bbb.ccc.ddd"):  # two and four segments
            self.assertIs(self._status(token), HhppStatus.OTHERWISE_INVALID)

    def test_oversized_token_rejected(self):
        self.assertIs(self._status("a" * (_MAX_HHPP_LEN + 1)), HhppStatus.OTHERWISE_INVALID)

    def test_disallowed_alg_rejected(self):
        for alg in ("none", "EdDSA", "HS256"):  # alg confusion and the legacy classical scheme
            header_b64 = b64url_encode(json.dumps({"alg": alg}).encode())
            self.assertIs(self._status(f"{header_b64}.{b64url_encode(b'{}')}.{b64url_encode(b'sig')}"),
                          HhppStatus.OTHERWISE_INVALID)

    def test_non_string_alg_rejected(self):
        # a non-string alg is unhashable, so the `in` membership test would raise without the
        # isinstance guard
        for alg in ([], {}, 5, None):
            header_b64 = b64url_encode(json.dumps({"alg": alg}).encode())
            self.assertIs(self._status(f"{header_b64}.{b64url_encode(b'{}')}.{b64url_encode(b'sig')}"),
                          HhppStatus.OTHERWISE_INVALID)

    def test_crit_header_rejected(self):
        header_b64 = b64url_encode(json.dumps({"alg": STANDARD_ALG, "crit": ["x"]}).encode())
        self.assertIs(self._status(f"{header_b64}.{b64url_encode(b'{}')}.{b64url_encode(b'sig')}"),
                      HhppStatus.OTHERWISE_INVALID)


class TestCheckHhppSignature(unittest.TestCase):
    """The signature gate, the not-ready guard, and the our/their-fault split around it."""

    def test_valid_hhpp_verifies_under_both_algs(self):
        for alg in (STANDARD_ALG, BESPOKE_ALG):
            result = check_hhpp(_mint(_hhpp_claims(), alg), _KEY, _CONSTELLATION)
            self.assertIs(result.status, HhppStatus.VERIFIED, alg)
            self.assertEqual(result.claims["ph-mc"], _HHPP_MESSAGE_CODE)

    def test_claims_returned_only_when_verified(self):
        claims = _hhpp_claims(hub_nonce="n", pp_issued_at=123)
        result = _check(claims)
        self.assertIs(result.status, HhppStatus.VERIFIED)
        self.assertEqual(result.claims, claims)

    def test_not_ready_without_key_or_constellation(self):
        token = _mint(_hhpp_claims())
        self.assertIs(check_hhpp(token, None, _CONSTELLATION).status, HhppStatus.OUR_CONSTELLATION_STALE)
        self.assertIs(check_hhpp(token, _KEY, None).status, HhppStatus.OUR_CONSTELLATION_STALE)

    def test_tampered_signature_is_a_genuine_bad_signature(self):
        # The ph-ci coincides with ours, so a rotation can't excuse the failure → OTHERWISE_INVALID.
        header_b64, payload_b64, sig_b64 = _mint(_hhpp_claims()).split(".")
        sig = bytearray(b64url_decode(sig_b64))
        for i in (0, len(sig) - 1):  # break the ML-DSA half, then the ed25519 half
            tampered = bytearray(sig)
            tampered[i] ^= 1
            token = f"{header_b64}.{payload_b64}.{b64url_encode(bytes(tampered))}"
            self.assertIs(check_hhpp(token, _KEY, _CONSTELLATION).status, HhppStatus.OTHERWISE_INVALID)

    def test_signature_checked_before_payload_trusted(self):
        # Keep a valid token's header and signature but swap in a garbage payload (invalidating the
        # signature): the outcome is a bad-signature rejection, not a MISMINTED decode error — proof
        # the signature is checked before the payload is read.
        header_b64, _, sig_b64 = _mint(_hhpp_claims()).partition(".")
        sig_b64 = sig_b64.rpartition(".")[2]
        token = f"{header_b64}.{b64url_encode(b'not json')}.{sig_b64}"
        self.assertIs(check_hhpp(token, _KEY, _CONSTELLATION).status, HhppStatus.OTHERWISE_INVALID)

    def test_validly_signed_unparseable_payload_is_misminted(self):
        # Only PHC can produce a valid signature, so validly-signed garbage is PHC's fault.
        for payload in (b"not json", b"[1, 2, 3]"):
            self.assertIs(check_hhpp(_mint_token(payload), _KEY, _CONSTELLATION).status, HhppStatus.MISMINTED)


class TestCheckHhppClaims(unittest.TestCase):
    """exp/nbf and the message-code gate, on a verified HHPP."""

    def test_expired_beyond_leeway(self):
        self.assertIs(_check(_hhpp_claims(exp=time.time() - _LEEWAY_SECONDS - 5)).status, HhppStatus.EXPIRED)

    def test_expired_within_leeway_still_valid(self):
        self.assertIs(_check(_hhpp_claims(exp=time.time() - 1)).status, HhppStatus.VERIFIED)

    def test_nbf_in_future_is_misminted(self):
        self.assertIs(_check(_hhpp_claims(nbf=time.time() + _LEEWAY_SECONDS + 5)).status, HhppStatus.MISMINTED)

    def test_non_numeric_exp_is_misminted(self):
        self.assertIs(_check(_hhpp_claims(exp="whenever")).status, HhppStatus.MISMINTED)

    def test_wrong_message_code_rejected(self):
        # a validly-signed message of another type, merely posted to enter-complete
        self.assertIs(_check(_hhpp_claims(code=12)).status, HhppStatus.OTHERWISE_INVALID)

    def test_missing_message_code_rejected(self):
        self.assertIs(_check(_hhpp_claims(code=None)).status, HhppStatus.OTHERWISE_INVALID)


class TestCheckHhppConstellation(unittest.TestCase):
    """Constellation routing, on both the verified path (ph-ci trusted) and the signature-failure
    path (ph-ci attacker-controlled).  _CONSTELLATION is created_at 1000 / id 'our-id'."""

    # --- verified path: ph-ci comes from PHC ---

    def test_verified_our_constellation_stale(self):
        self.assertIs(_check(_hhpp_claims(ci={"c": 1001, "i": "newer"})).status, HhppStatus.OUR_CONSTELLATION_STALE)

    def test_verified_their_constellation_stale(self):
        self.assertIs(_check(_hhpp_claims(ci={"c": 999, "i": "older"})).status, HhppStatus.THEIR_CONSTELLATION_STALE)

    def test_verified_constellations_diverged(self):
        self.assertIs(_check(_hhpp_claims(ci={"c": 1000, "i": "other"})).status, HhppStatus.CONSTELLATIONS_DIVERGED)

    def test_verified_malformed_ci_is_misminted(self):
        # a validly-signed, right-code HHPP with a broken ph-ci is PHC's fault
        for ci in ("not-a-dict", {"c": 1000}, {"i": "x"}, {"c": "nan", "i": "x"}, {"c": True, "i": "x"}):
            self.assertIs(_check(_hhpp_claims(ci=ci)).status, HhppStatus.MISMINTED, ci)

    # --- signature-failure path: ph-ci is unverified, only ever routes a retry ---

    def test_bad_sig_our_constellation_stale(self):
        token = _bad_sig_token({"ph-ci": {"c": 1001, "i": "newer"}})
        self.assertIs(check_hhpp(token, _KEY, _CONSTELLATION).status, HhppStatus.OUR_CONSTELLATION_STALE)

    def test_bad_sig_their_constellation_stale(self):
        token = _bad_sig_token({"ph-ci": {"c": 999, "i": "older"}})
        self.assertIs(check_hhpp(token, _KEY, _CONSTELLATION).status, HhppStatus.THEIR_CONSTELLATION_STALE)

    def test_bad_sig_constellations_diverged(self):
        token = _bad_sig_token({"ph-ci": {"c": 1000, "i": "other"}})
        self.assertIs(check_hhpp(token, _KEY, _CONSTELLATION).status, HhppStatus.CONSTELLATIONS_DIVERGED)

    def test_bad_sig_coinciding_constellation_is_genuine_bad_sig(self):
        # ph-ci matches ours, so divergence explains nothing — a real bad signature.
        token = _bad_sig_token({"ph-ci": {"c": 1000, "i": "our-id"}})
        self.assertIs(check_hhpp(token, _KEY, _CONSTELLATION).status, HhppStatus.OTHERWISE_INVALID)

    def test_bad_sig_malformed_ci_rejected(self):
        # unverified ph-ci is attacker-controlled: a missing/garbled one is the sender's fault
        for ci in ("not-a-dict", {"c": 1000}, {}):
            token = _bad_sig_token({"ph-ci": ci})
            self.assertIs(check_hhpp(token, _KEY, _CONSTELLATION).status, HhppStatus.OTHERWISE_INVALID, ci)

    def test_bad_sig_non_numeric_their_c_rejected(self):
        for c in ("not-a-number", True):  # a bool is an int subclass; must reject cleanly, never raise
            token = _bad_sig_token({"ph-ci": {"c": c, "i": "x"}})
            self.assertIs(check_hhpp(token, _KEY, _CONSTELLATION).status, HhppStatus.OTHERWISE_INVALID, c)

    def test_bad_sig_unusable_payload_rejected(self):
        # an undecodable or non-object payload leaves no ph-ci to route on → a genuine bad signature
        header_b64 = b64url_encode(json.dumps({"alg": STANDARD_ALG}).encode())
        for payload in (b"not json", b"[1, 2, 3]"):
            token = f"{header_b64}.{b64url_encode(payload)}.{b64url_encode(b'bogus signature')}"
            self.assertIs(check_hhpp(token, _KEY, _CONSTELLATION).status, HhppStatus.OTHERWISE_INVALID)


class TestAllowList(unittest.TestCase):
    def test_both_composite_algs_accepted(self):
        self.assertIn(BESPOKE_ALG, _ALG_CONTEXTS)
        self.assertIn(STANDARD_ALG, _ALG_CONTEXTS)


if __name__ == "__main__":
    unittest.main()
