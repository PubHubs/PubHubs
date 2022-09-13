
#
# This module does two things:
#   - decrypt pseudonym from pubhubs server at registration / login
#   - makes sure that the displayname always ends with pseudonym or is the same as the pseudonym
#
# Setting in homeserver.yaml:
#
# modules:
#  - module: data.modules.pseudonyms.Pseudonym
#    config: {
#       userinfo_endpoint : 'http://host.docker.internal:8080/userinfo',
#    }
#

import re
import os
import logging
import subprocess

from synapse.types import UserID
from synapse.module_api import ModuleApi
from synapse.http.server import DirectServeJsonResource, respond_with_json
from synapse.http.site import SynapseRequest


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

        # register webresource for creating pseudonym @registration/login. webresource_url is created from the 'oicd.userinfo_endpoint'
        webresource_url = self.api._hs.config.oidc.oidc_providers[0].userinfo_endpoint
        webresource_url = re.sub(r'.*?/_synapse/', "/_synapse/", webresource_url)
        self.api.register_web_resource(
            webresource_url,
            PseudonymWebResource( config, api )
        )

    #
    # Make sure displayname is pseudonym at registration
    #
    async def on_user_registration( self, user_id:str ):
        localpart = PseudonymHelper.get_local_username_part(user_id)
        current_displayname = await self.api._store.get_profile_displayname( localpart )
        display_name = PseudonymHelper.normalised_displayname( current_displayname, localpart )
        await self.api._store.set_profile_displayname( localpart, display_name )

    #
    # Make sure pseudonym is added to displayname when user changed displayname
    #
    async def change_displayname(self, user_id: str, new_profile: "synapse.module_api.ProfileInfo", by_admin: bool, deactivation: bool):
        localpart = PseudonymHelper.get_local_username_part(user_id)
        display_name = PseudonymHelper.normalised_displayname( new_profile.display_name, localpart )
        await self.api._store.set_profile_displayname( localpart, display_name )



#
# Getting pseudonym at registration/login and decrypt it using libpepcli
#
class PseudonymWebResource(DirectServeJsonResource):
    def __init__(self, config: dict, api: ModuleApi):
        super().__init__()
        self.api = api

        self.server_name = self.api.server_name
        self.userinfo_endpoint = config.get('userinfo_endpoint') or ''
        self.secret = os.environ['HUB_SECRET']

        if self.userinfo_endpoint == '':
            raise RuntimeError("No userinfo_endpoint set for module pseudonym.")

    #
    # After calling the pubhubs server, the given pseudonym needs to be decrypted and a localpart needs te be generated. This method does just that, given the encrypted pseuydonym
    #
    async def _async_render_GET(self, request: SynapseRequest):
        # For testing purposes (clumsy FakeRequest) all functionality, except the json response, in `async_get`
        response = await self.async_get(request)
        respond_with_json(request, 200, response)

    async def async_get(self, request: SynapseRequest) -> dict:
        # Call pubhubs server to get pseudonym
        AuthorizationHeader = request.getHeader('Authorization')
        response = await self.api.http_client.get_json(
            self.userinfo_endpoint,
            headers={"Authorization": [AuthorizationHeader]},
        )

        # Decrypt the pseudonym
        decrypted_local_pseudonym = subprocess.run(
            ["libpepcli", "decrypt-local-pseudonym", response["id"], self.secret],
            capture_output=True, check=True) \
            .stderr.decode('UTF-8') \
            .strip()

        # Get a short-pseudonym and test if its is allready used, if so take another
        localpart = None
        for localpart_candidate in PseudonymHelper.short_pseudonyms(decrypted_local_pseudonym):
            user_id = UserID(localpart, self.server_name).to_string()
            users = await self.api._store.get_users_by_id_case_insensitive(user_id)
            if not users or len(users) == 0:
                localpart = localpart_candidate
                break
        else:
            raise RuntimeError(
                f"All abbreviations of the local pseudonym { decrypted_local_pseudonym } have already been taken, which is exceedingly unlikely (unless the same user keeps re-registering.)")

        # Response with users' localpart and pseudonym
        response = {
            "id": decrypted_local_pseudonym,
            "short_pseudonym": localpart
        }
        logging.info(f"PUBHUBS: Unless { decrypted_local_pseudonym } is already assigned a local part, it will be { localpart }.")
        return response




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

    def short_pseudonyms(local_pseudonym):
        return PseudonymHelper.ShortPseudonymsIterator(local_pseudonym)

    class ShortPseudonymsIterator:
        def __init__(self, local_pseudonym):
            if not PseudonymHelper.is_local_pseudonym(local_pseudonym):
                raise ValueError(
                    f"{ local_pseudonym } is not a valid local pseudonym")
            self._lp = local_pseudonym
            self._counter = 1  # start with a 6-letter short pseudonym

        def __iter__(self):
            return self

        def __next__(self):
            self._counter += 1
            if self._counter > 15:
                raise StopIteration
            prefix, suffix = self._lp[:self._counter], self._lp[-self._counter:]

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
