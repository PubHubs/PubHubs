"""Tests for normalize_hub_url (modules/pubhubs/Core.py), which must make a hub's public_baseurl
compare equal to the url PHC advertises for that hub (which has /_synapse/client/ attached)."""

import sys
import unittest

sys.path.append("modules")
from pubhubs.Core import normalize_hub_url


class NormalizeHubUrlTest(unittest.TestCase):
    def test_drops_path_and_normalizes_case(self):
        for url in ("https://hub.example.org",
                    "https://hub.example.org/",
                    "https://Hub.Example.org/_synapse/client/",
                    "https://hub.example.org/some/other/path"):
            self.assertEqual(normalize_hub_url(url), "https://hub.example.org")

    def test_keeps_port_and_handles_ipv6(self):
        self.assertEqual(normalize_hub_url("http://145.137.188.115:8008/_synapse/client/"),
                         "http://145.137.188.115:8008")
        self.assertEqual(normalize_hub_url("http://[2A02:A466:6800:1::2]:8008/_synapse/client/"),
                         "http://[2a02:a466:6800:1::2]:8008")

    def test_distinct_hosts_and_ports_stay_distinct(self):
        self.assertNotEqual(normalize_hub_url("http://localhost:8008"),
                            normalize_hub_url("http://145.137.188.115:8008/_synapse/client/"))
        self.assertNotEqual(normalize_hub_url("http://localhost:8008"),
                            normalize_hub_url("http://localhost:8009"))


if __name__ == "__main__":
    unittest.main()
