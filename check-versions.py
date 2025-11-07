#!/bin/env python3

import os
import os.path
import argparse
import shutil
import sys
import subprocess
import json

def main():
    parser = argparse.ArgumentParser(
            description="Checks for missing software or outdated versions.")
   
    args = parser.parse_args()

    # NOTE:  We don't have to check for `python3`, `mask` or `sh`, because 
    # this script is invoked via them.
    # 
    # The version of python3 is checked via `check-python3-version.py`.

    check_cargo()
    check_docker()
    check_npm()
    check_yivi()

def check_yivi():
    check_for_command("irma")

def check_docker():
    check_for_command("docker")

def parse_version(version_str):
    return tuple(map(int, version_str.split(".")))

def parse_npm_engine_version(version_str):
    return parse_version(version_str.removeprefix(">="))

def check_npm():
    npm = check_for_command("npm")
    check_for_command("npx")
    node = check_for_command("node")

    required_npm_version = ()
    required_node_version = ()

    for dr in ("global-client", "hub-client"):
        data = None
        with open(os.path.join(dr, "package.json")) as f:
            data = json.load(f)
        required_npm_version = max(required_npm_version, 
                        parse_npm_engine_version(data["engines"]["npm"]))
        required_node_version = max(required_node_version, 
                        parse_npm_engine_version(data["engines"]["node"]))


    cp = subprocess.run(
            (npm, 
             "--version"),
            capture_output=True,
            check=True)
    present_npm_version_str = cp.stdout.decode('ascii').strip()
    present_npm_version = parse_version(present_npm_version_str)

    if present_npm_version < required_npm_version:
        required_npm_version_str = '.'.join(map(str,required_npm_version))
        print(f"PROBLEM: npm version >= {required_npm_version_str} is required,")
        print(f"but version {present_npm_version_str} is present.")

    cp = subprocess.run(
            (node, 
             "--version"),
            capture_output=True,
            check=True)
    present_node_version_str = cp.stdout.decode('ascii').removeprefix('v').strip()
    present_node_version = parse_version(present_node_version_str)
    
    if present_node_version < required_node_version:
        required_node_version_str = '.'.join(map(str,required_node_version))
        print(f"PROBLEM: node version >= {required_node_version_str} is required,")
        print(f"but version {present_node_version_str} is present.")

def parse_cargo_version(version_str):
    return parse_version(version_str)


def check_cargo():
    cargo = check_for_command("cargo")
    cp = subprocess.run(
            (cargo, 
             "metadata", 
             "--quiet", 
             "--no-deps"), 
            capture_output=True,
            cwd="pubhubs",
            check=True)
    metadata = json.loads(cp.stdout) 
    required_rust_version_str = metadata['packages'][0]['rust_version']
    required_rust_version = parse_cargo_version(required_rust_version_str)

    cp = subprocess.run(
            (cargo, 
             "--version"),
            capture_output=True,
            check=True)
    _, present_rust_version_bytes, *_ = cp.stdout.split(b" ", 3)
    present_rust_version_str = present_rust_version_bytes.decode('ascii')
    present_rust_version = parse_cargo_version(present_rust_version_str)

    if present_rust_version < required_rust_version:
        print(f"PROBLEM: cargo version >= {required_rust_version_str} is required,")
        print(f"but version {present_rust_version_str} is present.")
        print("")
        print("Please update your rust.  For most systems this can be done via:")
        print("    rustup update")
        sys.exit(1)


def check_for_command(command):
    path = shutil.which(command)
    if path == None:
        print(f"PROBLEM: the command '{command}' is required to run the local "
              "pubhubs development environment, but can not be found.")
        sys.exit(1)
    return path
    

if __name__ == "__main__":
    main()
