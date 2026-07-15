"""Unpadded base64url — the JWT-segment codec — shared by Core.py (the enter state/nonce) and
_hhpp.py (JWT parsing)."""

import base64


def b64url_encode(some_bytes):
    """Encode bytes as an unpadded base64url string."""
    return base64.urlsafe_b64encode(some_bytes).rstrip(b"=").decode("ascii")


def b64url_decode(segment):
    """Decode an unpadded base64url string, re-adding the stripped padding.  Wrong-length input
    raises ValueError; stray non-alphabet bytes are dropped (urlsafe_b64decode's default)."""
    return base64.urlsafe_b64decode(segment + "=" * (-len(segment) % 4))
