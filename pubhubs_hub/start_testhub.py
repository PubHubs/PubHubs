#!/usr/bin/env python3
# 
# Needs to be run from the pubhubs_hub directory
import argparse
import subprocess
import socket
import os.path
from urllib.parse import urlparse

def main():
    parser = argparse.ArgumentParser(
            description="Spins up a hub container for local development")

    parser.add_argument("--mode",
                        choices=("networkhost", "localhost"),
                        default="localhost",
                        help="Which hostname to use to (have clients) contact the clients and other servers:"
                        " localhost or 'networkhost', the IP address of the local internet interface. "
                        "Currently pubhubs does not work under 'networkhost' due to it not being a 'secure context' for crypto in the browser. "
                        "The networkhost _is_, however, always used by the yivi app to contact the yivi server at the hub. ")
    parser.add_argument("--networkhost", 
                        default=None,
                        help="Use this networkhost (e.g. '1.2.3.4', '[1::2]') instead of trying to autodetect it. Used e.g. by the yivi app to contact the hub.")
    parser.add_argument("--replace-sqlite3-by-postgres",
                        help="Passed to start_hub.py",
                        action=argparse.BooleanOptionalAction)
    parser.add_argument("number", 
                        choices=range(0,5),
                        type=int,
                        default=0,
                        nargs="?",
                        help="Which of the five testhubs to run.")

    parser.add_argument("passed_to_docker",
                        nargs="*",
                        help="Arguments passed to docker run")

    args = parser.parse_args()

    networkhost = args.networkhost

    if networkhost == None:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("k.root-servers.net", 53))
            networkhost = s.getsockname()[0]
        except:
            print("failed to obtain IPv4 address for network host; getting IPv6 address..")
            s = socket.socket(socket.AF_INET6, socket.SOCK_DGRAM)
            s.connect(("k.root-servers.net", 53))
            networkhost = "[" + s.getsockname()[0] + "]"

    match args.mode:
        case "networkhost":
            host = networkhost
        case "localhost":
            host = "localhost"
        case _:
            raise RuntimeError(f"unknown mode {args.mode}")

    hub_client_url = f"http://{host}:{8001+args.number}"
    hub_server_url = f"http://{host}:{8008+args.number}"
    hub_server_url_for_yivi = f"http://{networkhost}:{8008+args.number}"
    global_client_url = f"http://{host}:8080"
    phc_url = f"http://{host}:5050"

    replace_sqlite3_by_postgres = ()
    if args.replace_sqlite3_by_postgres != None: 
        prefix = "" if args.replace_sqlite3_by_postgres else "no-"
        replace_sqlite3_by_postgres = (f"--{prefix}replace-sqlite3-by-postgres",)

    subprocess.run(("docker", "run", 
                    "-it",
                    "--rm",
                    "--name", f"pubhubs-testhub{args.number}",
                    "-p", f"{8008+args.number}:8008",
                    "-v", f"{os.path.join(".","modules")}:/conf/modules:ro",
                    "-v", f"{os.path.join(".","boot")}:/conf/boot:ro",
                    "-v", f"{os.path.join(".",f"testhub{args.number}")}:/data:rw",
                    *args.passed_to_docker,
                    "--add-host", "host.docker.internal:host-gateway",
                    "pubhubs-hub",
                    "--environment", "development",
                    "--hub-client-url", hub_client_url,
                    "--hub-server-url", hub_server_url,
                    "--hub-server-url-for-yivi", hub_server_url_for_yivi,
                    "--global-client-url", global_client_url,
                    *replace_sqlite3_by_postgres,
                    ))

if __name__=="__main__":
    main()
