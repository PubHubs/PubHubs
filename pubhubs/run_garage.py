#!/usr/bin/env python3
# 
# Needs to be run from the pubhubs directory
#
# NB: We run docker from Python like this mainly because it's easier to pass
# the '-v' flag to docker this way.  
#
# For example, under git bash, '-v /local:/in/container' is translated to '-v C:\..\local;C:\..\in\container'.
import argparse
import subprocess
import os.path

def main():
    parser = argparse.ArgumentParser(
            description="Runs a garage S3 server for local development")

    parser.add_argument("--detach",
                        action='store_true',
                        default=False,
                        help='Do not wait for garage to stop.')

    args = parser.parse_args()

    subprocess.run(("docker", "run", 
                    "--name", "pubhubs-garage", 
                    "--detach" if args.detach else "--rm",
                    "-p", "3900:3900",
                    "-v", f"{os.path.join(".", "garage", "data")}:/var/lib/garage/data",
                    "-v", f"{os.path.join(".", "garage", "meta")}:/var/lib/garage/meta",
                    "-v", f"{os.path.join(".", "garage", "garage.toml")}:/etc/garage.toml",
                    "-e", "RUST_LOG=garage=info",
                    "dxflrs/garage:v2.1.0"))

if __name__=="__main__":
    main()
