#!/usr/bin/env python3
# 
# Needs to be run from the pubhubs_hub directory
import argparse
import subprocess
import socket
import os.path
import re
from urllib.parse import urlparse

# The n-th testhub runs its LiveKit on 7880+n, so several hubs can run side by side.
LIVEKIT_BASE_PORT = 7880


def write_livekit_config(number, port):
    """Write a per-hub LiveKit config into testhub<number>/ and return its path in the container.

    The port has to be the same inside and outside the container: the hub hands the browser the very
    same LIVEKIT_URL that it uses for its own server-side LiveKit API calls (see
    modules/pubhubs/_video_call_web.py). Publishing host 7880+n onto container 7880 would therefore
    still send every browser to hub 0's LiveKit - and because all dev hubs share the committed
    `devkey`, that token would even validate, so media would silently flow through the wrong hub.
    Giving each hub its own LiveKit port keeps a single URL correct in both places.

    The rtc media ports are left as they are: they are identical in every container, but since they
    are not published to the host they cannot collide.
    """
    base_config = os.path.join("config", "local", "livekit.local.yaml")
    hub_dir = f"testhub{number}"

    if not os.path.isdir(hub_dir):
        raise SystemExit(f"{hub_dir} does not exist; run 'mask run hub init testhub-dirs' first")

    with open(base_config) as f:
        config = f.read()

    config, substitutions = re.subn(r"^port:\s*\d+$", f"port: {port}", config, count=1, flags=re.MULTILINE)
    if substitutions != 1:
        raise SystemExit(f"expected exactly one top-level 'port:' line in {base_config}")

    with open(os.path.join(hub_dir, "livekit.yaml"), "w") as f:
        f.write(config)

    # testhub<number> is mounted at /data.
    return "/data/livekit.yaml"


def main():
    parser = argparse.ArgumentParser(
            description="Spins up a hub container for local development")

    parser.add_argument("--networkhost",
                        default=None,
                        help="Use this networkhost (e.g. '1.2.3.4', '[1::2]') instead of trying to autodetect it. Used e.g. by the yivi app to contact the hub.")
    parser.add_argument("--replace-sqlite3-by-postgres",
                        help="Passed to start_hub.py",
                        action=argparse.BooleanOptionalAction)

    parser.add_argument("--server-name",
                        help="Passed to start_hub.py.  Overwrites server_name in homeserver.yaml.",
                        default=None)

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

    # hub_client_url: the hub's iframe src, handed to the global client via PHC's `.ph/info`. Plain HTTP
    # on the networkhost IP, mirroring the PHC/global-client pattern — see docs/app/README.md.
    hub_client_url = f"http://{networkhost}:{8001+args.number}"
    # hub_server_url (public_baseurl): used server-side by PHC/yivi to reach the hub directly, so it
    # stays on the plain-http `networkhost` url from pubhubs.toml, unrelated to the browser-facing URL
    # above (that's hub-client's own HUB_URL, see maskfile.md's "hub client (n)").
    hub_server_url = f"http://{networkhost}:{8008+args.number}"
    # public_yivi_url: the hub's advertised Yivi disclosure-session proxy URL (_synapse/client/yiviproxy,
    # QR-encoded for the Yivi app, polled by the browser). Same plain-http address as hub_server_url —
    # enable Yivi's own "developer mode" on the phone scanning the QR code, or it'll refuse a plain-HTTP
    # session-pointer URL. See docs/app/README.md. Trailing slash: _web.py concatenates the yiviproxy
    # path onto this as-is.
    public_yivi_url = f"{hub_server_url}/"
    # global_client_url: the native app shell's own origin check (modules/pubhubs/HubClientApi.py),
    # unrelated to the above — always localhost, regardless of platform. See docs/app/README.md.
    global_client_url = "http://localhost:8080"

    replace_sqlite3_by_postgres = ()
    if args.replace_sqlite3_by_postgres != None: 
        prefix = "" if args.replace_sqlite3_by_postgres else "no-"
        replace_sqlite3_by_postgres = (f"--{prefix}replace-sqlite3-by-postgres",)

    server_name = ()
    if args.server_name != None:
        server_name = ("--server-name", args.server_name) 

    livekit_port = LIVEKIT_BASE_PORT + args.number
    livekit_config_path = write_livekit_config(args.number, livekit_port)

    subprocess.run(("docker", "run",
                    "-it",
                    "--rm",
                    "--name", f"pubhubs-testhub{args.number}",
                    "-p", f"{8008+args.number}:8008",
                    # Publish LiveKit's signalling port on the host loopback only. The dev
                    # LiveKit uses a key committed to the source tree, so it must not be
                    # reachable from other machines. Binding LiveKit itself to 127.0.0.1
                    # would break this: docker forwards published ports to the container's
                    # eth0, not its loopback, so we restrict exposure on the host side here.
                    # localhost:<livekit_port> (what the token endpoint hands the browser) still works.
                    "-p", f"127.0.0.1:{livekit_port}:{livekit_port}",
                    "-e", f"LIVEKIT_CONFIG_PATH={livekit_config_path}",
                    "-e", f"LIVEKIT_URL=http://localhost:{livekit_port}",
                    "-v", f"{os.path.join(".","modules")}:/conf/modules:ro",
                    "-v", f"{os.path.join(".","boot")}:/conf/boot:ro",
                    "-v", f"{os.path.join(".",f"testhub{args.number}")}:/data:rw",
                    *args.passed_to_docker,
                    "--add-host", "host.docker.internal:host-gateway",
                    "pubhubs-hub",
                    "--environment", "development",
                    "--hub-client-url", hub_client_url,
                    "--hub-server-url", hub_server_url,
                    "--public-yivi-url", public_yivi_url,
                    "--global-client-url", global_client_url,
                    *replace_sqlite3_by_postgres,
                    *server_name,
                    ))

if __name__=="__main__":
    main()
