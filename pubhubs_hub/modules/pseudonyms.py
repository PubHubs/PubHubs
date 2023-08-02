#
# This module does two things:
#   - decrypt pseudonym from pubhubs server at registration / login
#   - makes sure that the displayname always ends with pseudonym or is the same as the pseudonym
#

import re
import os
import logging
import subprocess
import ctypes

from synapse.types import UserID
from synapse.module_api import ModuleApi
from synapse.http.server import DirectServeJsonResource, respond_with_json
from synapse.http.site import SynapseRequest
from synapse.handlers.oidc import UserAttributeDict
from synapse.module_api.errors import ConfigError

logger = logging.getLogger(__name__)


#
# Main hook for the module
#
class Pseudonym:

    def __init__(self, config: dict, api: ModuleApi):
        self.api = api

        # register callbacks when displayname is changed (@registration or by user)
        self.api.register_account_validity_callbacks(
            on_user_registration = self.on_user_registration,
        )
        self.api.register_third_party_rules_callbacks(
            on_profile_update = self.change_displayname,
        )

    #
    # Make sure displayname is pseudonym at registration
    #
    async def on_user_registration( self, user_id : str ):
        await self.normalize_displayname( user_id )

    #
    # Make sure pseudonym is added to displayname when user changed displayname
    #
    async def change_displayname(self, user_id: str, new_profile: "synapse.module_api.ProfileInfo", by_admin: bool, deactivation: bool):
        await self.normalize_displayname( user_id, new_profile.display_name )

    #
    # Normalizes user_id's display_name.  If suggested_displayname is not None, uses that (after normalization.)
    # 
    async def normalize_displayname(self, user_id : str, suggested_displayname=None):
        user_id = UserID.from_string(user_id)
        displayname = suggested_displayname if suggested_displayname is not None else await self.api._store.get_profile_displayname( user_id )
        normalized_displayname = PseudonymHelper.normalised_displayname( suggested_displayname, user_id.localpart )
        logger.info(f"normalize_displayname {displayname} -> {normalized_displayname}")
        if normalized_displayname != displayname:
            await self.api._store.set_profile_displayname( user_id, normalized_displayname )



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

        if self._libpubhubs.decrypt(ctypes.byref(result_buf), ctypes.byref(ciphertext_buf), ctypes.byref(private_key_buf)) != 1:
            raise RuntimeError("failed to decrypt user's encrypted local pseudonym")

        decrypted_local_pseudonym = result_buf.raw.hex()

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

    #
    # Cleanup localpart/pseudonyms from displayname, and add it again at end of displayname. Or if empty, just the localpart
    #
    def normalised_displayname(display_name: str, localpart: str) -> str:
        if display_name == None or display_name == '' or display_name == localpart:
            display_name = localpart
        else:
            display_name = re.sub(r'\s*-*\s'+localpart, "", display_name)
            if display_name == '':
                display_name = localpart
            else:
                display_name = display_name + ' - ' + localpart
        return display_name


    #
    # Get localpart of user
    #
    def get_local_username_part(user: str) -> str:
        localpart = user.split(':')[0].strip('@')
        return localpart
