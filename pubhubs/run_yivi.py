#!/usr/bin/env python3
# 
# Needs to be run from the pubhubs directory
import sys
import argparse
import subprocess
import os.path
import socket

def main():
    parser = argparse.ArgumentParser(
            description="Runs a yivi server for local pubhubs development")

    parser.add_argument("--host", help="use this hostname in the --url passed to yivi. Autodetected if not set.")
    parser.add_argument("--port", type=int, help="use this port in the --url passed to yivi",
                        default=8189)
    parser.add_argument("--url", help="pass this --url to yivi (--host and --port are ignored)")
    parser.add_argument("--irma-path", help="path to irma binary", default="irma")

    args = parser.parse_args()

    # Yivi does not always detect the host's network address correctly,
    # so we do this for yivi instead

    url = args.url
    if url == None:
        url = get_url(args)

    if not os.path.isfile("yivi.toml"):
        print()
        print("error: cannot find yivi.toml")
        print()
        print(f"{sys.argv[0]} must be run from the 'pubhubs' directory")
        print()
        sys.exit(1)

    yivi_args = (args.irma_path, "server",
                "-c", "yivi.toml",
                "-v",
                "--sse",
                "--url", url)
    print(f"{sys.argv[0]}: starting {yivi_args}")

    try:
        result = subprocess.run(yivi_args)
    except FileNotFoundError as e:
        print()
        print(f"error:  could not find 'irma' binary at {args.irma_path}")
        print()
        print("for instructions on installing 'irma', see: ")
        print(" https://github.com/privacybydesign/irmago")
        print()
        sys.exit(1)

    sys.exit(result.returncode)

def get_url(args):
    host = args.host
    if host == None:
        host = get_host(args)

    return f"http://{host}:{args.port}"


def get_host(args):
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("k.root-servers.net", 53))
        host = s.getsockname()[0]
    except:
        print("failed to obtain IPv4 address for network host; getting IPv6 address..")
        s = socket.socket(socket.AF_INET6, socket.SOCK_DGRAM)
        s.connect(("k.root-servers.net", 53))
        host = "[" + s.getsockname()[0] + "]"
    return host


if __name__=="__main__":
    main()
