#!/usr/bin/env python3

import argparse
import logging
import os
import sys
import json
import os.path
import urllib.request
import urllib.parse
import urllib.error

logger = logging.getLogger(os.path.basename(__file__))

def main():
    parser = argparse.ArgumentParser(description="Checks which hubs are online, "
                                     "and what version they are running")

    parser.add_argument('-p', '--phc-url', 
                        default="https://app.pubhubs.net/", 
                        help="where to find pubhubs central")
    parser.add_argument('-t', '--timeout', type=int, default=2,
                        help="in number of seconds")

    parser.add_argument('-v', '--verbose', action='count', default=0,
                        help="verbosity - increases loglevel")

    args = parser.parse_args()

    loglevel = max(logging.DEBUG, logging.WARNING - 10 * args.verbose)
    logging.basicConfig(level=loglevel)

    Program(args).run()

class Program:
    def __init__(self, args):
        self._args = args
        self._hubs = {}

    def run(self):
        phc_url = self._args.phc_url

        hubs_url = urllib.parse.urljoin(phc_url, "bar/hubs")

        with self.get(hubs_url) as response:
            hubs = json.load(response)

        for hub in hubs:
            self._hubs[hub['id']] = hub

        for hub in hubs:
            self.retrieve_hub_info(hub['id'])

        self.print_hub_info()

    def retrieve_hub_info(self, hub_id):
        hub = self._hubs[hub_id]
        info_url = urllib.parse.urljoin(hub['server_uri'], "_synapse/client/.ph/info")
        try:
            with self.get(info_url) as response:
                hub['hub_info'] = json.load(response)
                logger.debug(f"{info_url}: {hub['hub_info']}")
        except urllib.error.URLError as e:
            logger.warn(f'failed to get {info_url}: {e}')
            hub['hub_info'] = { 'error': e }

    def print_hub_info(self):
        max_uri_len = max([len(hub['server_uri']) for hub in self._hubs.values()])

        for hub in self._hubs.values():
            hub_info = hub['hub_info']
            msg = None
            if 'error' in hub_info:
                msg = hub_info['error'].reason
                prefix = tc.ERROR
            else:
                msg = hub_info['hub_version']
                prefix = tc.OK
            print(f"{prefix}{hub['server_uri'].ljust(max_uri_len+1)} {msg}{tc.END}")

    def get(self, url):
        logger.debug(f"GET {url}")
        response = urllib.request.urlopen(url, timeout=self._args.timeout)
        logger.debug(f"GET {url} returned status code {response.status}")
        return response

# terminal colors
class tc:
    ERROR = "\033[91m"
    END = "\033[0m"
    OK = "\033[92m"


if __name__ == "__main__":
    main()
