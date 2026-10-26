"""The origins under which the PubHubs native app runs this hub's hub client.

The app bundles the hub client and serves it for every hub on an origin of its own,
<label>.hubs.pubhubs-app.invalid, with the label derived from the hub id.  The same label is
computed by hub-client (src/logic/utils/nativeHubOrigin.ts); keep the two in sync (their tests
share test vectors).  The Android app (HubOriginWebViewClient.java) only checks a host's shape.

Core resolves the hub id from PHC and records it here, so that HubClientApi, a separate module,
can allow exactly this hub's own native origins in CORS."""

import base64

from ._base64url import b64url_decode

NATIVE_HUB_HOST_SUFFIX = ".hubs.pubhubs-app.invalid"

# The app serves its pages over 'https' on Android and 'capacitor' on iOS (capacitor.config.ts).
NATIVE_APP_SCHEMES = ("https", "capacitor")

_own_hub_id = None


def set_own_hub_id(hub_id):
    """Record this hub's id (unpadded base64url), once Core has resolved it."""
    global _own_hub_id
    _own_hub_id = hub_id


def native_hub_label(hub_id):
    """Lowercase unpadded base32 of the 32-byte hub id: hostnames ignore case, base64url does not."""
    return base64.b32encode(b64url_decode(hub_id)).decode("ascii").rstrip("=").lower()


def native_hub_origins(hub_id):
    host = native_hub_label(hub_id) + NATIVE_HUB_HOST_SUFFIX
    return [f"{scheme}://{host}" for scheme in NATIVE_APP_SCHEMES]


def own_native_hub_origins():
    """This hub's native origins, or none while its hub id is not known yet."""
    if _own_hub_id is None:
        return []
    return native_hub_origins(_own_hub_id)
