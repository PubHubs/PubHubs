import os
import unittest
import subprocess
from unittest import IsolatedAsyncioTestCase
from unittest.mock import patch
from synapse.module_api import ModuleApi

import sys
sys.path.append("modules")
from pseudonyms import PseudonymHelper, Pseudonym


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





if __name__ == '__main__':
    unittest.main()
