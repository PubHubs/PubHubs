import os
import unittest
import subprocess
from unittest import IsolatedAsyncioTestCase
from unittest.mock import patch
from synapse.module_api import ModuleApi

import sys
sys.path.append("modules")
from pseudonyms import PseudonymHelper, Pseudonym, PseudonymWebResource


class TestPseudonymHelper(unittest.TestCase):

    def test_checkdigit(self):
        self.assertEqual(PseudonymHelper.checkdigit("000"), "0")
        self.assertEqual(PseudonymHelper.checkdigit("1"), "f")
        self.assertEqual(PseudonymHelper.checkdigit("10"), "e")
        self.assertEqual(PseudonymHelper.checkdigit("20"), "b")
        self.assertEqual(PseudonymHelper.checkdigit("8"), "1")

        # taking the inverse of the weight for the i-th digit,
        # we should get 15 times -1
        self.assertEqual(PseudonymHelper.checkdigit_alphabet[-15 % 17],
            PseudonymHelper.checkdigit(''.join([
                PseudonymHelper.checkdigit_alphabet[pow(16-i, -1, 17)]
                    for i in range(0, 15)])))

        # all ones will give the sum -2 - 3 - 4 - ... - 16
        self.assertEqual(PseudonymHelper.checkdigit_alphabet[(1-17*16//2) % 17], PseudonymHelper.checkdigit(15*'1'))

    def test_short_pseudonums(self):
        self.assertEqual(
            list(PseudonymHelper.short_pseudonyms("0123456789"*6+"abcd")), [
                '01f-6cd',
                '012a-dbcd',
                '01231-eabcd',
                '012344-b9abcd',
                '0123451-689abcd',
                '01234568-1789abcd',
                '012345677-f6789abcd',
                '012345678e-g56789abcd',
                '0123456789b-6456789abcd',
                '012345678900-43456789abcd',
                '0123456789014-c23456789abcd',
                '01234567890125-f123456789abcd',
                '012345678901232-f0123456789abcd',
                '012345678901234b-790123456789abcd'
                ])

    def test_normalised_displayname(self):
        self.assertEqual(PseudonymHelper.normalised_displayname( None, '01f-6cd'), '01f-6cd')
        self.assertEqual(PseudonymHelper.normalised_displayname( '', '01f-6cd'), '01f-6cd')
        self.assertEqual(PseudonymHelper.normalised_displayname( '01f-6cd', '01f-6cd'), '01f-6cd')
        self.assertEqual(PseudonymHelper.normalised_displayname( ' 01f-6cd', '01f-6cd'), '01f-6cd')
        self.assertEqual(PseudonymHelper.normalised_displayname( ' - 01f-6cd', '01f-6cd'), '01f-6cd')
        self.assertEqual(PseudonymHelper.normalised_displayname( '01f-6cd - Test', '01f-6cd'), '01f-6cd - Test - 01f-6cd')
        self.assertEqual(PseudonymHelper.normalised_displayname( 'Test', '01f-6cd'), 'Test - 01f-6cd')
        self.assertEqual(PseudonymHelper.normalised_displayname( '01f-6cd - 01f-6cd - 01f-6cd', '01f-6cd'), '01f-6cd - 01f-6cd')
        self.assertEqual(PseudonymHelper.normalised_displayname( '01f-6cd01f-6cd', '01f-6cd'), '01f-6cd01f-6cd - 01f-6cd')



#
# 'Some' fakes for testing webresource
#

class FakeModuleApi():

    class FakeModuleApiHS():

        class FakeModuleApiHSConfig():

            class FakeModuleApiHSConfigServer():

                class FakeModuleApiHSConfigServerServername():
                    server_name = 'fake_server'

                server = FakeModuleApiHSConfigServerServername()

            config = FakeModuleApiHSConfigServer()

        class FakeStore():
            async def get_users_by_id_case_insensitive(self,user_id):
                return []

        _hs = FakeModuleApiHSConfig()
        _store = FakeStore()

        def server_name(self):
            return 'fakeserver'
        @property
        def http_client(self):
            return self._http_client
        class FakeHttpClient():
            id = ""
            def setId(self,id):
                self.id = id
            async def get_json(self, metadata, headers="unused"):
                return { 'id': self.id }

        _http_client = FakeHttpClient()

    api = FakeModuleApiHS()

    def setEncryptedPseudonym(self,id):
        self.api.http_client.setId(id)


class FakeConfig():
    user_info_endpoint = 'http://endpoint.fake'
    def get(self,key):
        return self.user_info_endpoint

class FakeRequest():
    AuthorizationHeader = "FakeHeader"
    def getHeader(self,key):
        return self.AuthorizationHeader



#
# Test webresource
#
class TestPseudonymWebresource(IsolatedAsyncioTestCase):

    async def test_webresource(self):
        with patch.dict(os.environ, {'HUB_SECRET': 'b89964f2a4650b0b75c1c35c79e00f923511985e2ed08d8a91066274db369900'}, clear=False):
            FakeModuleApi().setEncryptedPseudonym("3a5e2494eaa37be7b5de738a1b75abcab46e23856476ba83b86c14882aeec1354468a739f235760955fdb7b843ec48def9d70ae5cbefcb23561a3dc76ac3731e64e7b633bd059acf022b5c72539fe33d12a71b9f993d4751d8676bde88f4850d")
            webresource = PseudonymWebResource( FakeConfig(), FakeModuleApi().api )
            user_info = await webresource.async_get(FakeRequest())

            self.assertIn('id', user_info)
            self.assertIn('short_pseudonym', user_info)


    async def test_replacement(self):
        [public_global_key, secret_global_key] = subprocess.run(["libpepcli", "generate-global-keys"], capture_output=True).stdout.decode('UTF-8').splitlines()
        encrypted_global_pseudonym = subprocess.run(["libpepcli", "generate-pseudonym", "some_identity", public_global_key], capture_output=True).stderr.decode('UTF-8').strip()

        server_secret = "really_secret"
        decryption_context = "decryption_context"

        encrypted_local_pseudonym = subprocess.run(["libpepcli", "convert-to-local-pseudonym", encrypted_global_pseudonym, server_secret, decryption_context, "pseudonymisation-context"], capture_output=True).stderr.decode('UTF-8').strip()
        local_decryption_key = subprocess.run(["libpepcli", "make-local-decryption-key",secret_global_key, server_secret, decryption_context], capture_output=True).stderr.decode('UTF-8').strip()
        decrypted_local_pseudonym = subprocess.run(["libpepcli", "decrypt-local-pseudonym", encrypted_local_pseudonym, local_decryption_key], capture_output=True).stderr.decode('UTF-8').strip()

        with patch.dict(os.environ, {'HUB_SECRET': local_decryption_key}, clear=False):

            # Re-encrypt the local pseudonym so we see the decryption matches the previous decryption.
            encrypted_local_pseudonym_for_server = subprocess.run( ["libpepcli", "convert-to-local-pseudonym", encrypted_global_pseudonym, server_secret,decryption_context, "pseudonymisation-context"], capture_output=True).stderr.decode('UTF-8').strip()

            FakeModuleApi().setEncryptedPseudonym(encrypted_local_pseudonym_for_server)
            webresource = PseudonymWebResource( FakeConfig(), FakeModuleApi().api )
            user_info = await webresource.async_get(FakeRequest())

            self.assertEqual(decrypted_local_pseudonym, user_info["id"])
            self.assertIn('short_pseudonym', user_info)


    async def test_replacement_can_fail_with_bad_secret(self):
        [public_global_key, _] = subprocess.run(["libpepcli", "generate-global-keys"], capture_output=True).stdout.decode('UTF-8').splitlines()
        encrypted_global_pseudonym = subprocess.run(["libpepcli", "generate-pseudonym", "some_identity", public_global_key], capture_output=True).stderr.decode('UTF-8').strip()

        server_secret = "really_secret"
        decryption_context = "decryption_context"

        with patch.dict(os.environ, {'HUB_SECRET': "bad_secret"}, clear=False):

            # Re-encrypt the local pseudonym so we see the decryption matches the previous decryption.
            encrypted_local_pseudonym_for_server = subprocess.run( ["libpepcli", "convert-to-local-pseudonym", encrypted_global_pseudonym, server_secret, decryption_context, "pseudonymisation-context"],capture_output=True).stderr.decode('UTF-8').strip()

            with self.assertRaises(subprocess.CalledProcessError):
                FakeModuleApi().setEncryptedPseudonym(encrypted_local_pseudonym_for_server)
                webresource = PseudonymWebResource( FakeConfig(), FakeModuleApi().api )
                user_info = await webresource.async_get(FakeRequest())


    async def test_replacement_can_fail_with_bad_pseudonym(self):
        [_, secret_global_key] = subprocess.run(["libpepcli", "generate-global-keys"], capture_output=True).stdout.decode('UTF-8').splitlines()

        server_secret = "really_secret"
        decryption_context = "decryption_context"

        local_decryption_key = subprocess.run(["libpepcli", "make-local-decryption-key", secret_global_key, server_secret, decryption_context], capture_output=True).stderr.decode('UTF-8').strip()

        with patch.dict(os.environ, {'HUB_SECRET': local_decryption_key}, clear=False):
            with self.assertRaises(subprocess.CalledProcessError):
                FakeModuleApi().setEncryptedPseudonym(local_decryption_key)
                webresource = PseudonymWebResource( FakeConfig(), FakeModuleApi().api )
                user_info = await webresource.async_get(FakeRequest())


if __name__ == '__main__':
    unittest.main()
