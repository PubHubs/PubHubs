"""Utility functions for cors handling."""

import logging
from typing import List
from synapse.http.site import SynapseRequest

logger = logging.getLogger("synapse.contrib." + __name__)

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
