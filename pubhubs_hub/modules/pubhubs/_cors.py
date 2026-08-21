"""Utility functions for HTTP header handling."""

import logging
from typing import List
from synapse.http.site import SynapseRequest
from twisted.web.server import Request

logger = logging.getLogger("synapse.contrib." + __name__)


def modify_set_clickjacking_protection_headers(original, global_client_url: str):
    """
    This function returns a changed form of `synapse.http.server.set_clickjacking_protection_headers`.
    This allows embedding the page asking the user to agree to the hub's terms and conditions.
    It is a bit hacky. And we hope it will become configurable in Synapse.

    Args:
        original: The original clickjacking protection function.
        global_client_url: The global client url the terms and conditions can be allowed in.
    """

    def modified(request: Request):
        original(request)
        if request.path in (
            b"/_synapse/client/new_user_consent",
            b"/_synapse/client/oidc/callback",
            b"/_synapse/client/sso_register",
        ):
            request.responseHeaders.removeHeader(b"X-Frame-Options")
            request.setHeader(b"Content-Security-Policy", f"frame-ancestors {global_client_url};".encode())

    return modified


def modify_set_cors_headers(original):
    """
    This function returns a changed form of `synapse.http.server.set_cors_headers`.
    This allows the Yivi SSE endpoint to be proxied since it asks for the "Cache-Control" header to be allowed.
    For this endpoint it's fine to allow this.
    It is a bit hacky. And we hope it will become configurable in Synapse.

    Args:
        original: The original allowed cors header function.
    """

    def modified(request: Request):
        original(request)
        if request.path.endswith(b"/frontend/statusevents"):
            request.setHeader(
                b"Access-Control-Allow-Headers",
                b"X-Requested-With, Content-Type, Authorization, Date, Cache-Control",
            )

    return modified


def set_allow_origin_header(
    request: SynapseRequest,
    allowed_origins: List[str],
) -> None:
    """
    This function is necessary because only 1 origin can be given to Access-Control-Allow-Origin at a time
    Set cors header based on the origin of the request, if it is in the allowed list (Currently either the client_url or dev_url).
    
    Args:
        request
        allowed_origins

    """
    origin = request.getHeader(b"Origin")
    decoded_origin = origin.decode() if isinstance(origin, bytes) else None

    if decoded_origin in allowed_origins:
        request.setHeader(b"Access-Control-Allow-Origin", origin)


def set_public_allow_origin_header(request: SynapseRequest) -> None:
    """
    Allow any origin to read this response.

    Unlike `set_allow_origin_header`, this does not consult an allowlist, so use it only for
    resources that are public and carry no credentials — for those there is nothing an allowlist
    would protect. It exists because `<img>` needs no CORS at all but `fetch()` does, and the hub
    media (icon/banner) GETs are read via `fetch()` by the global client so the native shell's https
    origin doesn't auto-upgrade their plain-HTTP dev address (see hub-client's useImageObjectUrl and
    docs/app/README.md). Those GETs are unauthenticated (`@user_validator(GUEST)`) and the global
    client's origin differs per deployment and per dev machine, which an allowlist would have to
    track.

    Args:
        request

    """
    request.setHeader(b"Access-Control-Allow-Origin", b"*")
