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

# Oidc mapping provider for PubHubs that decrypts the encrypted local pseudonym, and
# turns it into a short pseudonym.
# 
# References:
#   - https://matrix-org.github.io/synapse/latest/sso_mapping_providers.html
#   - https://github.com/matrix-org/synapse/blob/6ac35667af31f6d3aa81a8b5d00425e6e7e657e7/synapse/handlers/oidc.py#L1532
class OidcMappingProvider:
    def __init__(self, config):
        self._config = config
        self._secret = os.environ['HUB_SECRET']
        self._libpubhubs = ctypes.CDLL(config["libpubhubspath"])

    @staticmethod
    def parse_config(config):
        if "libpubhubspath" not in config:
            logger.error(f"the invalid config was: {config}")
            raise ConfigError("Please configure 'libpubhubspath'")
        return config

    def get_remote_user_id(self, userinfo):
        logger.info(f"get_remote_user_id {userinfo}")
        encrypted_local_pseudonym = userinfo["sub"]

        result_buf = ctypes.create_string_buffer(32)
        ciphertext_buf = ctypes.create_string_buffer(96)
        private_key_buf = ctypes.create_string_buffer(32)

        ciphertext_buf.raw = bytes.fromhex(encrypted_local_pseudonym)
        private_key_buf.raw = bytes.fromhex(self._secret)

        match self._libpubhubs.decrypt(ctypes.byref(result_buf), ctypes.byref(ciphertext_buf), ctypes.byref(private_key_buf)):
            case 1: # Ok
                pass
            case 2: # WrongPublicKey
                raise RuntimeError("failed to decrypt user's encrypted local pseudonym - encrypted for another public key (not HUB_SECRET)")
            case 3: # InvalidTriple
                raise RuntimeError("failed to decrypt user's encrypted local pseudonym - not a valid ElGamal ciphertext")
            case 4: # InvalidPrivateKey
                raise RuntimeError("failed to decrypt user's encrypted local pseudonym - invalid HUB_SECRET")
            case _ as ec: 
                raise RuntimeError(f"failed to decrypt user's encrypted local pseudonym - unknown error code {ec}")

        decrypted_local_pseudonym = result_buf.raw.hex()

        assert decrypted_local_pseudonym != "0000000000000000000000000000000000000000000000000000000000000000"

        # HACK: For efficiency's sake, we add the decrypted local pseudonym to userinfo,
        # so that it can be used in map_user_attributes below.  This seems to work for now,
        # but might break in the future as it's not clear that mutating userinfo like this is
        # a feature intended by the synapse authors.  If it breaks, we could add a lookup table
        # from "sub" to "phlp" in this (OidcMappingProvider) class.
        userinfo["phlp"] = decrypted_local_pseudonym

        return decrypted_local_pseudonym

    async def map_user_attributes(self, userinfo, token, failures):
        logger.info(f"map_user_attributes {userinfo} {token} {failures}")
        return UserAttributeDict(
                localpart = PseudonymHelper.short_pseudonym_nr(userinfo["phlp"], failures),
                confirm_localpart = False)

    async def get_extra_attributes(self, userinfo, token):
        logger.info(f"get_extra_attributes {userinfo} {token}")
        return {}


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
