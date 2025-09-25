#!/usr/bin/env python3
# 
# Needs to be run from the pubhubs_hub directory
import argparse
import subprocess
import socket
from urllib.parse import urlparse

def main():
    parser = argparse.ArgumentParser(
            description="Spins up a hub container for local development")

    args = parser.parse_args()

    networkhost = ""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("k.root-servers.net", 53))
        networkhost = s.getsockname()[0]
    except:
        print("failed to obtain IPv4 address for network host; getting IPv6 address..")
        s = socket.socket(socket.AF_INET6, socket.SOCK_DGRAM)
        s.connect(("k.root-servers.net", 53))
        networkhost = "[" + s.getsockname()[0] + "]"

    hub_client_url = f"http://{networkhost}:8001"
    hub_server_url = f"http://{networkhost}:8008"
    global_client_url = f"http://{networkhost}:8080"
    phc_url = f"http://{networkhost}:5050"

    subprocess.run(("docker", "run", 
                    "-it",
                    "--rm",
                    "--name", "pubhubs-testhub0",
                    "-p", "8008:8008",
                    "-v", "./modules:/conf/modules:ro",
                    "-v", "./boot:/conf/boot:ro",
                    "-v", "./testhub0:/data:rw",
                    "--add-host", "host.docker.internal:host-gateway",
                    "pubhubs-hub",
                    "--environment", "development",
                    "--hub-client-url", hub_client_url,
                    "--hub-server-url", hub_server_url,
                    "--global-client-url", global_client_url,
                    ))

if __name__=="__main__":
    main()
