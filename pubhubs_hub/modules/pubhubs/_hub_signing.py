"""The hub's own signing key, and the PHC ticket that vouches for it.

Some PubHubs servers want to know which hub calls them, such as the transcryptor's `.ph/push`. A hub
proves this with a `TicketSigned` request (see `pubhubs/src/api/phc.rs`): a ticket, which PHC signs
and which names the hub and its verifying key, together with the request, signed by the hub.

PHC learns the hub's verifying key from the hub's `.ph/info`, when the hub asks for a ticket. So a hub
needs no configuration for this: it makes a key the first time it starts, and keeps it on disk.

The key and signatures are the composite ML-DSA-65 + Ed25519 of `pubhubs/src/common/dsa.rs`, and the
JWTs are those of `pubhubs/src/misc/jwt.rs` and `pubhubs/src/api/signed.rs`.
"""

import base64
import json
import logging
import os
import tempfile
import time

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.asymmetric.mldsa import MLDSA65PrivateKey

from ._base64url import b64url_decode, b64url_encode
from ._hhpp import BESPOKE_ALG, _message_representative

logger = logging.getLogger("synapse.contrib." + __name__)

# `MessageCode`s in pubhubs/src/api/signed.rs.
PHC_HUB_TICKET_REQ = 1
TRANSCRYPTOR_PUSH_REQ = 16

# Where the hub keeps its signing key, unless configured otherwise. `/data` survives restarts.
DEFAULT_KEY_PATH = "/data/pubhubs_hub_signing_key.json"

# Rust's `Claims::nbf` sets `nbf` this many seconds in the past, against clock skew.
_NBF_LEEWAY_SECONDS = 30

# Fetch a new ticket when the current one expires within this many seconds (tickets last a day).
_TICKET_RENEW_MARGIN_SECONDS = 3600


def _b64(data: bytes) -> str:
    """Standard, padded base64, as `B64` in pubhubs/src/misc/serde_ext.rs."""
    return base64.b64encode(data).decode("ascii")


class HubSigningKey:
    """A composite ML-DSA-65 + Ed25519 signing key, like Rust's `api::SigningKey`."""

    def __init__(self, ed_seed: bytes, ml_seed: bytes):
        if len(ed_seed) != 32 or len(ml_seed) != 32:
            raise ValueError("a hub signing key consists of two 32-byte seeds")
        self._ed_seed = ed_seed
        self._ml_seed = ml_seed
        self._ed = Ed25519PrivateKey.from_private_bytes(ed_seed)
        self._ml = MLDSA65PrivateKey.from_seed_bytes(ml_seed)

    @classmethod
    def generate(cls) -> "HubSigningKey":
        return cls(os.urandom(32), os.urandom(32))

    @classmethod
    def from_json(cls, data: dict) -> "HubSigningKey":
        """From `{"ed": .., "ml": ..}`, Rust's `SigningKeyBytes`, as `cargo run tools generate
        signing-key` prints it."""
        return cls(base64.b64decode(data["ed"]), base64.b64decode(data["ml"]))

    def to_json(self) -> dict:
        return {"ed": _b64(self._ed_seed), "ml": _b64(self._ml_seed)}

    def verifying_key(self) -> dict:
        """Rust's `VerifyingKeyBytes`, for the `verifying_key` in the hub's `.ph/info`."""
        return {
            "ed": _b64(self._ed.public_key().public_bytes_raw()),
            "ml": _b64(self._ml.public_key().public_bytes_raw()),
        }

    def sign(self, message: bytes) -> bytes:
        """ML-DSA-65 signature ‖ Ed25519 signature over the composite message representative. The
        ML-DSA context is empty, as for the `ph-ML-DSA-65-Ed25519` algorithm."""
        m_prime = _message_representative(message)
        return self._ml.sign(m_prime) + self._ed.sign(m_prime)

    def sign_message(self, message: dict, message_code: int, valid_for: int = 60) -> str:
        """A `Signed<T>` (a JWT) of `message`, as Rust's `Signed::new`: the message's fields, plus
        `nbf`, `exp` and the message code `ph-mc`."""
        now = int(time.time())
        claims = dict(message)
        claims["nbf"] = now - _NBF_LEEWAY_SECONDS
        claims["exp"] = now + valid_for
        claims["ph-mc"] = message_code
        header = b64url_encode(json.dumps({"alg": BESPOKE_ALG}, separators=(",", ":")).encode())
        payload = b64url_encode(json.dumps(claims, separators=(",", ":")).encode())
        to_be_signed = f"{header}.{payload}"
        return f"{to_be_signed}.{b64url_encode(self.sign(to_be_signed.encode('ascii')))}"


def load_or_create_key(path: str) -> HubSigningKey:
    """Loads the hub's signing key from `path`, or makes one and stores it there.

    Several Synapse workers may start at once. The key is written to a temporary file first, and
    then hard-linked into place, which fails if `path` exists: so `path` only ever holds a complete
    key, and whoever loses the race reads the winner's."""
    try:
        with open(path) as f:
            return HubSigningKey.from_json(json.load(f))
    except FileNotFoundError:
        pass

    key = HubSigningKey.generate()
    directory = os.path.dirname(os.path.abspath(path))
    try:
        fd, tmp = tempfile.mkstemp(dir=directory, prefix=".hub_signing_key.")
    except OSError as e:
        raise RuntimeError(
            f"cannot store the hub signing key in {directory} ({e}); set hub_signing_key_path in "
            "the pubhubs module config to a writable location"
        ) from e
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(key.to_json(), f)
            f.flush()
            os.fsync(f.fileno())
        try:
            os.link(tmp, path)
        except FileExistsError:
            with open(path) as f:
                return HubSigningKey.from_json(json.load(f))
    finally:
        os.unlink(tmp)
    logger.info(f"made a new hub signing key, stored in {path}")
    return key


def _jwt_exp(jwt: str):
    """The `exp` claim of a JWT, without checking its signature, or None."""
    try:
        return int(json.loads(b64url_decode(jwt.split(".")[1]))["exp"])
    except Exception:
        return None


class HubTickets:
    """Gets and keeps the PHC ticket of this hub, and signs requests with it (`TicketSigned`)."""

    def __init__(self, key: HubSigningKey, http_client):
        self._key = key
        self._http_client = http_client
        self._phc_url = None
        self._handle = None
        self._ticket = None
        self._ticket_exp = 0

    def set_hub(self, phc_url: str, handle: str):
        """Called when the hub knows its handle at PHC, from the constellation."""
        if handle != self._handle or phc_url != self._phc_url:
            self._ticket = None
        self._phc_url = phc_url
        self._handle = handle

    def forget_ticket(self):
        """After a server answered `RetryWithNewTicket`."""
        self._ticket = None

    async def _get_ticket(self):
        if self._ticket is not None and self._ticket_exp - time.time() > _TICKET_RENEW_MARGIN_SECONDS:
            return self._ticket
        if self._handle is None:
            return None

        from urllib.parse import urljoin

        url = urljoin(self._phc_url, ".ph/hub/ticket")
        req = self._key.sign_message({"handle": self._handle}, PHC_HUB_TICKET_REQ)
        try:
            resp = await self._http_client.post_json_get_json(url, req)
        except Exception as e:
            logger.warning(f"could not get a ticket from PHC: {e}")
            return None
        success = (resp.get("Ok") or {}) if isinstance(resp.get("Ok"), dict) else {}
        ticket = success.get("Success")
        if not isinstance(ticket, str):
            # e.g. "NoVerifyingKey" while PHC can't reach our .ph/info yet
            logger.warning(f"PHC did not give us a ticket: {resp}")
            return None
        self._ticket = ticket
        self._ticket_exp = _jwt_exp(ticket) or 0
        return ticket

    async def ticket_signed(self, message: dict, message_code: int):
        """A `TicketSigned<T>` of `message`, or None when there's no ticket (yet)."""
        ticket = await self._get_ticket()
        if ticket is None:
            return None
        return {"ticket": ticket, "signed": self._key.sign_message(message, message_code)}
