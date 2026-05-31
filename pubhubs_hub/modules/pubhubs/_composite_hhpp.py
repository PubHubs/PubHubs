"""Post-quantum HHPP verification: the composite ML-DSA-65 + Ed25519 signature scheme.

PHC signs the HashedHubPseudonymPackage (HHPP) with a composite signature from
draft-ietf-jose-pq-composite-sigs: an ML-DSA-65 *and* an Ed25519 signature, both of which must
verify.  This module teaches authlib to verify it, mirroring `src/common/dsa.rs` on the backend.
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
import hashlib

import authlib.jose

from cryptography.exceptions import InvalidSignature, UnsupportedAlgorithm
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

try:
    from cryptography.hazmat.primitives.asymmetric.mldsa import MLDSA65PublicKey
except ImportError as e:
    raise RuntimeError(
        "PubHubs hub requires ML-DSA for post-quantum HHPP verification: install "
        "cryptography>=48 (its wheels bundle OpenSSL 3.5) or build it against AWS-LC/BoringSSL. "
        "On local development, rebuild the hub image with `mask run hub init testhub-image`."
    ) from e

# Cheaply exercise the backend by parsing a dummy public key (no expensive keygen); this raises
# UnsupportedAlgorithm on a build whose OpenSSL lacks ML-DSA (e.g. < 3.5).
try:
    MLDSA65PublicKey.from_public_bytes(b"\x00" * 1952)
except UnsupportedAlgorithm as e:
    raise RuntimeError(
        "the installed cryptography has no ML-DSA backend (need cryptography>=48 with "
        "OpenSSL 3.5+, or a build against AWS-LC/BoringSSL). "
        "On local development, rebuild the hub image with `mask run hub init testhub-image`."
    ) from e


# JWS `alg` values, matching `ALG` in src/common/dsa.rs and the JOSE registration.
BESPOKE_ALG = "ph-ML-DSA-65-Ed25519"  # interim, empty ML-DSA context
STANDARD_ALG = "ML-DSA-65-Ed25519"  # conformant, ML-DSA context = Label

# Composite-combiner constants (draft-ietf-lamps-pq-composite-sigs §2.2/§6), byte-for-byte
# identical to src/common/dsa.rs.
_PREFIX = b"CompositeAlgorithmSignatures2025"
_LABEL = b"COMPSIG-MLDSA65-Ed25519-SHA512"
_CTX = b""  # composite application context, empty for our JWTs (encoded in M' as len(ctx) ‖ ctx)
_MLDSA65_SIG_LEN = 3309
_ED25519_SIG_LEN = 64


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
        return False
    return True


class _CompositeJWSAlgorithm(authlib.jose.JWSAlgorithm):
    """authlib JWS algorithm for a composite variant.  Subclasses set `name` (the JWS `alg`) and
    `mldsa_ctx`."""

    mldsa_ctx = None

    def prepare_key(self, raw_data):
        # the key resolver already hands us a prepared CompositeKey
        return raw_data

    def sign(self, msg, key):
        raise NotImplementedError("the hub only verifies composite signatures")

    def verify(self, msg, sig, key):
        return verify(msg, sig, key, self.mldsa_ctx)


class _BespokeComposite(_CompositeJWSAlgorithm):
    name = BESPOKE_ALG
    description = "Composite ML-DSA-65 + Ed25519, interim empty ML-DSA context (see dsa.rs)"
    mldsa_ctx = b""


class _StandardComposite(_CompositeJWSAlgorithm):
    name = STANDARD_ALG
    description = "Composite ML-DSA-65 + Ed25519 (draft-ietf-jose-pq-composite-sigs)"
    mldsa_ctx = _LABEL


authlib.jose.JsonWebSignature.register_algorithm(_BespokeComposite())
authlib.jose.JsonWebSignature.register_algorithm(_StandardComposite())

# Decode HHPPs against an explicit allow-list of just the two composite variants.  This also blocks
# `alg` confusion attacks ("none"/HS256 substitution) and the legacy classical EdDSA.
hhpp_jwt = authlib.jose.JsonWebToken([BESPOKE_ALG, STANDARD_ALG])
