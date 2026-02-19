#!/usr/bin/env python3

import argparse
import subprocess
import threading
import update_config
import os
import sys
import shutil
import time
import yaml

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
    parser.add_argument("--hub-server-url-for-yivi", default=None,
                        help="Overwrites the hub server url used by the yivi app in the homeserver configuration")
    parser.add_argument("--global-client-url", default=None,
                        help="Overwrites the global client url in the homeserver configuration")
    parser.add_argument("--replace-sqlite3-by-postgres",
                        help="Replaces the configured sqlite3 database by a postgres database running inside this container."
                             "Performs a migration, if necessary, moving homeserver.db to homeserver.db.bak "
                             "to indicate a succefull migration.  Will abort when a postgres data directory is present, "
                             "but homeserver.db.bak is not.",
                        action=argparse.BooleanOptionalAction,
                        default=True)

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

        uc = update_config.run(input_file=old_config_path,
                          output_file=live_config_path,
                          environment=self._args.environment,
                          hub_client_url=self._args.hub_client_url,
                          hub_server_url=self._args.hub_server_url,
                          hub_server_url_for_yivi=self._args.hub_server_url_for_yivi,
                          global_client_url=self._args.global_client_url,
                          replace_sqlite3_by_postgres=self._args.replace_sqlite3_by_postgres)

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

        if self._args.replace_sqlite3_by_postgres:
            # NOTE: postgres command have a bad habit of changing TTY options, such as 'onlcr', so
            # that the terminal output looks
            #                               like this, because \n is no longer
            #                                                                 translated to \r\n.
            # Setting stdin=subprocess.DEVNULL seems to prevent this.

            # find postres executable path
            pg_data_dir = "/data/postgres"
            pg_bindir = subprocess.run(('sudo', '-u', 'postgres',
                                     'pg_config', '--bindir'),
                                    stdin=subprocess.DEVNULL,
                                    check=True, capture_output=True).stdout.strip().decode('utf-8')

            fresh_db = self.prepare_pg_data_dir(pg_data_dir=pg_data_dir, pg_bindir=pg_bindir)

            sqlite3_path = uc._rsbp_sqlite3_path
            if not fresh_db and not os.path.exists(sqlite3_backup_path := sqlite3_path + '.bak'):
                time.sleep(1)
                print()
                print(f"WARNING: found postgres data directory at {pg_data_dir} (inside the container),")
                print(f"         but did not find {sqlite3_backup_path} (inside the container) indicating")
                print( "         a successful migration to the postgres directory.)")
                print( "")
                print(f"If you removed the {sqlite3_backup_path} file to safe space,")
                print( "just put a placeholder there.")
                print()
                print( "If the migration did not succeed yet, remove the postgres data directory,")
                print( "and restart this container.")
                print()
                time.sleep(5)
                sys.exit(1)

            # run postgres, so we can issue commands to it
            self._waiter.add("postgres", 
                             subprocess.Popen(('sudo', '-u', 'postgres',
                                               os.path.join(pg_bindir, "postgres"),
                                               '-D', pg_data_dir),
                                               stdin=subprocess.DEVNULL))
            countdown = 5
            while subprocess.run(("sudo", "-u", "postgres", "pg_isready", "-q"), 
                                 stdin=subprocess.DEVNULL).returncode != 0:
                print(f"waiting {countdown} seconds for the postgres server to come up")
                time.sleep(1)
                countdown -= 1
                if countdown == 0:
                    raise RuntimeError("postgres server did not start properly; the reason might be in the logs above")

            if fresh_db:
                subprocess.run(("sudo", "-u", "postgres", "createuser", "synapse"), 
                               stdin=subprocess.DEVNULL, check=True)
                subprocess.run(("sudo", "-u", "postgres", 
                                "createdb", "hub",
                                "--encoding=UTF8",
                                "--locale=C",
                                "--template=template0",
                                "--owner=synapse"), 
                               stdin=subprocess.DEVNULL, check=True)

                # Run vanilla synapse migration; we want to run this on a homeserver without any of our modules,
                # because our code is definitely not written with the possibility of a migration running

                migration_config_path = live_config_path + "-for_migration"

                with open(live_config_path, "r") as f:
                    config = yaml.safe_load(f)
                config['modules'] = []
                with open(migration_config_path, "w") as f:
                    yaml.dump(config, f)

                subprocess.run(("synapse_port_db", 
                                "--sqlite-database", sqlite3_path,
                                "--postgres-config", migration_config_path),
                               check=True)


        self._waiter.add("synapse", subprocess.Popen(("/start.py",)))

        self._waiter.wait()

    def prepare_pg_data_dir(self, pg_data_dir, pg_bindir):
        if os.path.exists(pg_data_dir):
            return False

        os.mkdir(pg_data_dir)

        subprocess.run(("sudo", "-u", "postgres", 
                        os.path.join(pg_bindir, "initdb"), pg_data_dir),
                       stdin=subprocess.DEVNULL, check=True)

        return True


# wait() waits for any of the processes added to Waiter to quit
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
