"""Post-quantum HHPP verification: the composite ML-DSA-65 + Ed25519 signature scheme.

PHC signs the HashedHubPseudonymPackage (HHPP) with a composite signature from
draft-ietf-jose-pq-composite-sigs: an ML-DSA-65 *and* an Ed25519 signature, both of which must
verify.  This module verifies that composite signature — mirroring `src/common/dsa.rs` on the
backend — and decodes the surrounding JWT itself (without a JWT library).  Hand-rolling the tiny
JWT envelope is deliberate: a general JWT library supports many algorithms and features — and so
carries far more attack surface — than this single fixed composite scheme needs.
Two variants differ only in the context fed to the ML-DSA primitive:

  - `BESPOKE_ALG`  "ph-ML-DSA-65-Ed25519"  interim: empty ML-DSA context, because aws-lc-rs exposes
    none yet (the backend's sole deviation from the standard; see dsa.rs).
  - `STANDARD_ALG` "ML-DSA-65-Ed25519"     conformant: ML-DSA context = the Label.

We verify both, so the hub keeps working when the backend later goes conformant.  We do NOT accept
the legacy classical Ed25519 HHPP: hubs are upgraded only after the central servers, so by the time
this runs PHC already signs the composite.

ML-DSA is mandatory: importing this module fails loudly if the cryptography backend lacks it,
rather than letting the hub run without post-quantum verification.
"""

import base64
import collections
import enum
import hashlib
import json
import logging
import time

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

from ._base64url import b64url_decode

try:
    from cryptography.hazmat.primitives.asymmetric.mldsa import MLDSA65PublicKey
except ImportError as e:
    raise RuntimeError(
        "PubHubs hub requires ML-DSA for post-quantum HHPP verification: install "
        "cryptography>=48 (its wheels bundle OpenSSL 3.5) or build it against AWS-LC/BoringSSL. "
        "On local development, rebuild the hub image with `mask run hub init testhub-image`."
    ) from e

# Cheaply exercise the backend by parsing a dummy public key (no expensive keygen); this fails on a
# build whose OpenSSL lacks ML-DSA (e.g. < 3.5).  Catch every error, not just the expected
# UnsupportedAlgorithm, so any other backend quirk still surfaces as the actionable message below.
try:
    MLDSA65PublicKey.from_public_bytes(b"\x00" * 1952)
except Exception as e:
    raise RuntimeError(
        "the installed cryptography has no working ML-DSA backend (need cryptography>=48 with "
        "OpenSSL 3.5+, or a build against AWS-LC/BoringSSL). "
        "On local development, rebuild the hub image with `mask run hub init testhub-image`."
    ) from e


logger = logging.getLogger("synapse.contrib." + __name__)


# JWT `alg` values, matching `ALG` in src/common/dsa.rs.
BESPOKE_ALG = "ph-ML-DSA-65-Ed25519"  # interim, empty ML-DSA context
STANDARD_ALG = "ML-DSA-65-Ed25519"  # conformant, ML-DSA context = Label

# Composite-combiner constants (draft-ietf-lamps-pq-composite-sigs §2.2/§6), byte-for-byte
# identical to src/common/dsa.rs.
_PREFIX = b"CompositeAlgorithmSignatures2025"
_LABEL = b"COMPSIG-MLDSA65-Ed25519-SHA512"
_CTX = b""  # composite application context, empty for our JWTs (encoded in M' as len(ctx) ‖ ctx)
_MLDSA65_SIG_LEN = 3309
_ED25519_SIG_LEN = 64

# Accepted algorithms mapped to their ML-DSA signature context.
_ALG_CONTEXTS = {BESPOKE_ALG: b"", STANDARD_ALG: _LABEL}

# A complete ML-DSA hybrid signature is 3373 bytes (~4.5 KiB base64url); a real HHPP is a few KiB.
# Reject anything larger before parsing, bounding the base64/JSON work an attacker can force.
_MAX_HHPP_LEN = 8192

# Clock-skew tolerance for the exp/nbf checks, since PHC and the hub are different machines.
_LEEWAY_SECONDS = 15

# The `ph-mc` message code of an HHPP (`MessageCode::Hhpp` in the backend):
# https://rust.docs.pubhubs.net/pubhubs/api/enum.MessageCode.html#variant.Hhpp
# PHC signs other message types with other codes; one carrying a different code was minted for
# another purpose and merely sent here.
_HHPP_MESSAGE_CODE = 11


class HhppStatus(enum.Enum):
    """The verdict from [`check_hhpp`]; for VERIFIED the trusted claims ride alongside in
    [`HhppOpenResult.claims`], otherwise they are None."""

    VERIFIED = "verified"
    OUR_CONSTELLATION_STALE = "our_constellation_stale"
    THEIR_CONSTELLATION_STALE = "their_constellation_stale"
    # constellations differ at the same created_at: can't tell whose is stale
    CONSTELLATIONS_DIVERGED = "constellations_diverged"
    # the sender's fault: malformed, misrouted (not an hhpp), or a bad signature not explained by a
    # constellation rotation
    OTHERWISE_INVALID = "otherwise_invalid"
    # a validly-signed hhpp — or our own constellation — that is itself malformed: PHC's fault
    MISMINTED = "misminted"
    EXPIRED = "expired"


# `claims` holds the trusted claims dict only when `status is HhppStatus.VERIFIED`; otherwise None.
HhppOpenResult = collections.namedtuple("HhppOpenResult", "status claims")


class CompositeKey:
    """PHC's composite verifying key: an Ed25519 and an ML-DSA-65 public key."""

    __slots__ = ("ed", "ml")

    def __init__(self, ed, ml):
        self.ed = ed
        self.ml = ml


def parse_verifying_key(vk):
    """Build a [`CompositeKey`] from the constellation's `phc_verifying_key` = {"ed": .., "ml": ..}
    (standard base64, the `VerifyingKeyBytes` wire form).  Raises on malformed input."""
    return CompositeKey(
        ed=Ed25519PublicKey.from_public_bytes(base64.b64decode(vk["ed"])),
        ml=MLDSA65PublicKey.from_public_bytes(base64.b64decode(vk["ml"])),
    )


def verify(signing_input, signature, key, mldsa_ctx):
    """Verify a composite signature (ML-DSA-65 sig ‖ ed25519 sig, both over `M'`).  `mldsa_ctx` is
    the context passed to the ML-DSA primitive (empty for the bespoke variant, the Label for the
    standard one).  Returns True only if *both* halves verify.  Mirrors `is_valid_signature` in
    src/common/dsa.rs."""
    if len(signature) != _MLDSA65_SIG_LEN + _ED25519_SIG_LEN:
        return False
    ml_sig = signature[:_MLDSA65_SIG_LEN]
    ed_sig = signature[_MLDSA65_SIG_LEN:]
    # M' = PREFIX ‖ LABEL ‖ len(ctx) ‖ ctx ‖ SHA-512(signing_input), the message both halves sign.
    m_prime = _PREFIX + _LABEL + bytes([len(_CTX)]) + _CTX + hashlib.sha512(signing_input).digest()
    try:
        key.ml.verify(ml_sig, m_prime, mldsa_ctx)
        key.ed.verify(ed_sig, m_prime)
    except InvalidSignature:
        return False  # the normal "this signature does not verify" outcome
    except Exception as e:
        # cryptography raises only InvalidSignature here in practice; anything else is unexpected.
        # Log it, but still fail closed — mirroring the catch-all `.is_ok()` in is_valid_signature
        # (src/common/dsa.rs) — so an odd backend error can't escape as a 500 on this unauthenticated
        # endpoint.
        logger.warning(f"unexpected error verifying composite HHPP signature: {e}")
        return False
    return True


def check_hhpp(hhpp, key, constellation):
    """Open an HHPP without raising: verify its composite signature against `key`, then validate the
    signed claims as a current, unexpired HHPP.  Returns an [`HhppOpenResult`]; see [`HhppStatus`]
    for the possible outcomes.  `key` (a [`CompositeKey`]) and `constellation` come from the hub's
    last /welcome; either being None means we are not set up yet, treated like a stale constellation."""
    if constellation is None or key is None:
        logger.info("no constellation or verifying key yet; treating as a stale constellation")
        return HhppOpenResult(HhppStatus.OUR_CONSTELLATION_STALE, None)
    if not isinstance(constellation.get("created_at"), int) or "id" not in constellation:
        # our own constellation is malformed (PHC's fault, like a misminted hhpp) and a refetch would
        # just pull the same garbage, so don't ask the client to retry — fail with an internal error.
        # (Also guarantees _check_for_diverging_constellations can read created_at/id below.)
        logger.error("our constellation lacks a usable created_at/id")
        return HhppOpenResult(HhppStatus.MISMINTED, None)

    # Split the JWT and decode its header only; the payload stays encoded until the signature is
    # checked.  A non-string/oversized/non-three-segment token, bad base64/JSON, a non-object header,
    # an unsupported `crit`, or a disallowed `alg` are all the sender's doing.  (Size is tested before
    # `count`/`partition` to bound the work an attacker can force; isinstance before the `in` test
    # because a non-string alg is unhashable and would raise rather than reject cleanly.)
    if not isinstance(hhpp, str) or len(hhpp) > _MAX_HHPP_LEN or hhpp.count(".") != 2:
        return HhppOpenResult(HhppStatus.OTHERWISE_INVALID, None)
    signing_input, _, signature_b64 = hhpp.rpartition(".")
    header_b64, _, payload_b64 = signing_input.partition(".")
    try:
        header = json.loads(b64url_decode(header_b64))
        signature = b64url_decode(signature_b64)
        signing_input = signing_input.encode("ascii")
    except ValueError:  # bad base64/JSON/UTF-8, or a non-ASCII segment
        return HhppOpenResult(HhppStatus.OTHERWISE_INVALID, None)
    if not isinstance(header, dict) or "crit" in header:  # no critical extensions implemented (RFC 7515)
        return HhppOpenResult(HhppStatus.OTHERWISE_INVALID, None)
    alg = header.get("alg")
    if not isinstance(alg, str) or alg not in _ALG_CONTEXTS:
        return HhppOpenResult(HhppStatus.OTHERWISE_INVALID, None)

    if not verify(signing_input, signature, key, _ALG_CONTEXTS[alg]):
        # The signature did not verify — usually a key rotation, not a forgery: PHC rotated its key
        # and either we or the client's HHPP is on the wrong side.  Route on the now-untrusted ph-ci,
        # which only ever selects a retry, never anything security-sensitive (mirrors Signed::open in
        # src/api/signed.rs); _check_for_diverging_constellations logs each divergence case it distinguishes.
        try:
            unverified = json.loads(b64url_decode(payload_b64))
        except ValueError:
            return HhppOpenResult(HhppStatus.OTHERWISE_INVALID, None)
        if not isinstance(unverified, dict):
            return HhppOpenResult(HhppStatus.OTHERWISE_INVALID, None)
        status = _check_for_diverging_constellations(unverified, constellation, trusted=False)
        if status is None:
            # Constellations coincide: we hold the very key that should have signed this, so a
            # divergence can't be blamed — the signature is genuinely bad.
            logger.info("hhpp signature did not verify against the current constellation; rejecting")
            return HhppOpenResult(HhppStatus.OTHERWISE_INVALID, None)
        return HhppOpenResult(status, None)

    # The signature verified, so PHC authored these exact bytes: from here, anything malformed is
    # PHC's doing (MISMINTED), not the sender's.
    try:
        claims = json.loads(b64url_decode(payload_b64))  # signed bytes, trusted now
    except ValueError:
        logger.error("validly-signed hhpp has an undecodable payload")
        return HhppOpenResult(HhppStatus.MISMINTED, None)
    if not isinstance(claims, dict):
        logger.error("validly-signed hhpp payload is not a JSON object")
        return HhppOpenResult(HhppStatus.MISMINTED, None)

    # PHC signs every message type and can't control where they are sent, so before applying any
    # HHPP-specific check, confirm this *is* an HHPP: a validly-signed message bearing a different
    # code was minted for another purpose and merely posted here — the sender's fault, not a
    # misminted HHPP.  Checking it first keeps the exp/nbf- and ph-ci-fault attributions below honest:
    # they blame PHC only once we know the message was meant to be an HHPP.
    if claims.get("ph-mc") != _HHPP_MESSAGE_CODE:
        logger.info("validly-signed message is not an hhpp (wrong message code)")
        return HhppOpenResult(HhppStatus.OTHERWISE_INVALID, None)

    now = time.time()  # exp/nbf carry a leeway, since PHC and the hub are different machines
    try:
        exp = claims.get("exp")
        if exp is not None and exp + _LEEWAY_SECONDS < now:
            logger.info("expired hhpp submitted")
            return HhppOpenResult(HhppStatus.EXPIRED, None)
        nbf = claims.get("nbf")
        if nbf is not None and nbf - _LEEWAY_SECONDS > now:
            logger.error("validly-signed hhpp is not yet valid (nbf in the future)")
            return HhppOpenResult(HhppStatus.MISMINTED, None)
    except TypeError:  # non-numeric exp/nbf
        logger.error("validly-signed hhpp has a non-numeric exp/nbf")
        return HhppOpenResult(HhppStatus.MISMINTED, None)

    status = _check_for_diverging_constellations(claims, constellation, trusted=True)
    if status is not None:
        return HhppOpenResult(status, None)
    return HhppOpenResult(HhppStatus.VERIFIED, claims)


def _check_for_diverging_constellations(claims, constellation, trusted):
    """Compare the HHPP's `ph-ci` (its constellation claim) to ours.  Returns the [`HhppStatus`] to
    short-circuit on, or None when the constellations coincide and the caller should proceed.
    `trusted` says whether the signature verified: a malformed ph-ci is PHC's fault on the verified
    path (MISMINTED) but attacker-supplied on a signature failure (OTHERWISE_INVALID)."""
    malformed = HhppStatus.MISMINTED if trusted else HhppStatus.OTHERWISE_INVALID
    ci = claims.get("ph-ci")
    if not isinstance(ci, dict) or "c" not in ci or "i" not in ci:
        return malformed
    their_c = ci["c"]
    their_i = ci["i"]
    # their_c is compared with `<`.  PHC serializes created_at as a JSON integer (NumericDate is a
    # u64; see src/misc/jwt.rs), so require an int — rejecting a bool (an int subclass) and, on the
    # attacker-controlled signature-failure path, the float NaN/Infinity that json.loads would accept,
    # rather than raising TypeError.  (their_i is only ever compared with `!=`.)
    if not isinstance(their_c, int) or isinstance(their_c, bool):
        return malformed
    our_c = constellation["created_at"]
    our_i = constellation["id"]
    if our_c < their_c:
        logger.info("our constellation is out of date")
        return HhppStatus.OUR_CONSTELLATION_STALE
    if their_c < our_c:
        logger.info("hhpp signed under an older constellation")
        return HhppStatus.THEIR_CONSTELLATION_STALE
    if our_i != their_i:
        logger.info("constellations diverge at the same created_at")
        return HhppStatus.CONSTELLATIONS_DIVERGED
    return None
