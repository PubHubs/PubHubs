#
# This module decrypts the pseudonym from pubhubs server at registration / login,
# and selects the localpart for the user's matrix ID based on it
#

import re
import os
import logging
import subprocess
import ctypes

from synapse.types import UserID, create_requester
from synapse.module_api import ModuleApi
from synapse.http.server import DirectServeJsonResource, respond_with_json
from synapse.http.site import SynapseRequest
from synapse.handlers.oidc import UserAttributeDict
from synapse.module_api.errors import ConfigError

logger = logging.getLogger(__name__)

class Pseudonym:
    def __init__(self, config: dict, api: ModuleApi):
        self.api = api

class PseudonymHelper:
    local_pseudonym_pattern = re.compile("[a-f0-9]{64}")
    checkdigit_alphabet = "0123456789abcdefg"

    # computes an ISBN10-style checksum for the string s, using mod 17 instead
    # of mod 11, so that s can be a 15 character hex-string (instead of 9
    # decimal digits.)
    def checkdigit(s):
        N = len(s)
        assert(N <= 15)
        cs = 0
        for i in range(1, N+1):
            cs = (cs - (i+1) * int(s[N-i], 17)) % 17
        return PseudonymHelper.checkdigit_alphabet[cs]

    def is_local_pseudonym(s):
        return PseudonymHelper.local_pseudonym_pattern.fullmatch(s) != None

    # used for testing
    @classmethod
    def short_pseudonyms(cls, local_pseudonym):
        for n in range(14):
            yield cls.short_pseudonym_nr(local_pseudonym, n)

    # returns the nth short pseudonym associated to the local_pseudonym,
    # the nth consisting of 2*(3+n) letters and a '-'. 
    def short_pseudonym_nr(local_pseudonym, n):
        if not PseudonymHelper.is_local_pseudonym(local_pseudonym):
            raise ValueError(
                f"{ local_pseudonym } is not a valid local pseudonym")
        if n > 13:
            raise ValueError("n can't exceed 14")
        prefix_len = n + 2
        prefix, suffix = local_pseudonym[:prefix_len], local_pseudonym[-prefix_len:]

        return f"{ prefix }{ PseudonymHelper.checkdigit(prefix) }-{ PseudonymHelper.checkdigit(suffix) }{ suffix }"
