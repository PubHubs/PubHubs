#!/usr/bin/env python3

import argparse
import subprocess
import threading
import update_config
import os

def main():
    parser = argparse.ArgumentParser(
            description="Start a PubHubs hub")

    parser.add_argument("-e", "--environment",
                        help="Influences the checks performed on the /data/homeserver.yaml file.",
                        choices=("production", "development"),
                        default="production")

    parser.add_argument("--hub-client-url", default=None,
                        help="Overwrites the hub client url in the homeserver configuration")
    parser.add_argument("--hub-server-url", default=None,
                        help="Overwrites the hub server url in the homeserver configuration")
    parser.add_argument("--global-client-url", default=None,
                        help="Overwrites the global client url in the homeserver configuration")

    Program(parser.parse_args()).run()


class Program:
    def __init__(self, args):
        self._args = args
        self._waiter = Waiter()

    def run(self):
        # Using the same defaults for SYNAPSE_CONFIG_DIR and SYNAPSE_CONFIG_PATH here
        #   as Synapse's docker container:  
        # <https://github.com/element-hq/synapse/blob/70c044db8efabacf3deaf8635d98c593b722541a/docker/start.py#L164>
        if "SYNAPSE_CONFIG_DIR" not in os.environ:
            os.environ["SYNAPSE_CONFIG_DIR"] = "/data"
        config_dir = os.environ["SYNAPSE_CONFIG_DIR"]
        
        if "SYNAPSE_CONFIG_PATH" not in os.environ:
            os.environ["SYNAPSE_CONFIG_PATH"] = os.path.join(config_dir, "homeserver.yaml")
        old_config_path = os.environ["SYNAPSE_CONFIG_PATH"]

        # make sure synapse loads the updated configuration
        live_config_path = old_config_path[:-len("yaml")] + "live.yaml"
        os.environ["SYNAPSE_CONFIG_PATH"] = live_config_path

        update_config.run(input_file=old_config_path,
                          output_file=live_config_path,
                          environment=self._args.environment,
                          hub_client_url=self._args.hub_client_url,
                          hub_server_url=self._args.hub_server_url,
                          global_client_url=self._args.global_client_url)

        self._waiter.add("yivi", subprocess.Popen(("/usr/bin/irma", 
                        "server",
                        "--issue-perms", "*",
                        "--production",
                        "--no-email",
                        "--no-tls",
                        "--sse",
                        "--allow-unsigned-callbacks",
                        "--no-auth",
                        "-l", "0.0.0.0",
                        "-p", "8089",
                        "--client-listen-addr", "0.0.0.0",
                        "--client-port", "8088")))

        if self._args.environment == "development":
            os.putenv("AUTHLIB_INSECURE_TRANSPORT", "for_development_only_of_course")

        self._waiter.add("synapse", subprocess.Popen(("/start.py",)))

        self._waiter.wait()


class Waiter:
    def __init__(self):
        self._barrier = threading.Barrier(2)

    def add(self, name, process):
        # daemon=True makes sure that this thread does not keep the whole process alive when the main thread exists
        threading.Thread(target=Waiter.wait_for_process_to_exit, args=(name, process, self._barrier), daemon=True).start()

    def wait(self):
        self._barrier.wait()

    @staticmethod
    def wait_for_process_to_exit(name, process, barrier):
        process.wait()
        print(f"ERROR: {name} exited early!")
        barrier.wait()


if __name__ == "__main__":
    main()
