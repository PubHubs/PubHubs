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

    parser.add_argument("--mode",
                        choices=("networkhost", "localhost"),
                        default="localhost",
                        help="Which hostname to use to (have clients) contact the clients and other servers:"
                        " localhost or 'networkhost', the IP address of the local internet interface")
    parser.add_argument("number", 
                        choices=range(0,5),
                        type=int,
                        default=0,
                        nargs="?",
                        help="Which of the five testhubs to run.")

    args = parser.parse_args()

    host = ""

    match args.mode:
        case "networkhost":
            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                s.connect(("k.root-servers.net", 53))
                host = s.getsockname()[0]
            except:
                print("failed to obtain IPv4 address for network host; getting IPv6 address..")
                s = socket.socket(socket.AF_INET6, socket.SOCK_DGRAM)
                s.connect(("k.root-servers.net", 53))
                host = "[" + s.getsockname()[0] + "]"
        case "localhost":
            host = "localhost"
        case _:
            raise RuntimeError(f"unknown mode {args.mode}")


    hub_client_url = f"http://{host}:{8001+args.number}"
    hub_server_url = f"http://{host}:{8008+args.number}"
    global_client_url = f"http://{host}:8080"
    phc_url = f"http://{host}:5050"

    subprocess.run(("docker", "run", 
                    "-it",
                    "--rm",
                    "--name", f"pubhubs-testhub{args.number}",
                    "-p", f"{8008+args.number}:8008",
                    "-v", "./modules:/conf/modules:ro",
                    "-v", "./boot:/conf/boot:ro",
                    "-v", f"./testhub{args.number}:/data:rw",
                    "--add-host", "host.docker.internal:host-gateway",
                    "pubhubs-hub",
                    "--environment", "development",
                    "--hub-client-url", hub_client_url,
                    "--hub-server-url", hub_server_url,
                    "--global-client-url", global_client_url,
                    ))

if __name__=="__main__":
    main()
