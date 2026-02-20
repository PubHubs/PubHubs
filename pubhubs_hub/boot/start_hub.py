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
import sqlite3
import psycopg2
import contextlib

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
                        default=False)

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

            fresh_db = False
            if not os.path.exists(pg_data_dir):
                fresh_db = True

                print(f"Creating {pg_data_dir} ...")
                os.mkdir(pg_data_dir)
                
                print(f"Changing owner and group of {pg_data_dir} to postgres")
                shutil.chown(pg_data_dir, user="postgres", group="postgres") 
                # If we don't do this, the next command might fail.

                print(f"Initializing postgres data directory at {pg_data_dir} ...")
                subprocess.run(("sudo", "-u", "postgres", 
                                os.path.join(pg_bindir, "initdb"), pg_data_dir),
                               stdin=subprocess.DEVNULL, check=True)

            sqlite3_path = uc._rsbp_sqlite3_path
            sqlite3_backup_path = sqlite3_path + '.bak'
            if not fresh_db and not os.path.exists(sqlite3_backup_path):
                time.sleep(1)
                print()
                print(f"WARNING: found postgres data directory at {pg_data_dir} (inside the container),")
                print(f"         but did not find {sqlite3_backup_path} (inside the container) indicating")
                print( "         a successful migration to the postgres directory.")
                print()
                print(f"         If you removed the {sqlite3_backup_path} file to safe space,")
                print( "         just put a placeholder there.")
                print()
                print( "         If the migration did not succeed yet, remove the postgres data directory,")
                print( "         and restart this container to try again.")
                print()
                print( "         If you want to opt out, pass --no-replace-sqlite3-by-postgres to the hub.")
                print()
                time.sleep(5)
                sys.exit(1)

            # run postgres, so we can issue commands to it
            print("Starting postgres ...")
            self._waiter.add("postgres", 
                             subprocess.Popen(('sudo', '-u', 'postgres',
                                               os.path.join(pg_bindir, "postgres"),
                                               '-D', pg_data_dir),
                                               stdin=subprocess.DEVNULL))
            countdown = 300
            while subprocess.run(("sudo", "-u", "postgres", "pg_isready", "-q"), 
                                 stdin=subprocess.DEVNULL).returncode != 0:
                print(f"Waiting {countdown} seconds for the postgres server to come up ...")
                time.sleep(1)
                countdown -= 1
                if countdown == 0:
                    raise RuntimeError("postgres server did not start properly; the reason might be in the logs above")

            if fresh_db:
                print("Creating `synapse` postgres user ...")
                subprocess.run(("sudo", "-u", "postgres", "createuser", "synapse"), 
                               stdin=subprocess.DEVNULL, check=True)
                print("Creating `hub` database ...")
                subprocess.run(("sudo", "-u", "postgres", 
                                "createdb", "hub",
                                "--encoding=UTF8",
                                "--locale=C",
                                "--template=template0",
                                "--owner=synapse"), 
                               stdin=subprocess.DEVNULL, check=True)

                # only run migration if there is a sqlite3 database
                if os.path.exists(sqlite3_path):
                    # Run vanilla synapse migration; we want to run this on a homeserver without any of our modules,
                    # because our code is definitely not written with the possibility of a migration running
                    migration_config_path = live_config_path + "-for_migration"

                    print(f"Creating {migration_config_path} ...")
                    with open(live_config_path, "r") as f:
                        config = yaml.safe_load(f)
                    config['modules'] = []
                    with open(migration_config_path, "w") as f:
                        yaml.dump(config, f)

                    print(f"Running vanilla Synapse migration {sqlite3_path} -> postgres (this might take a while!) ...")
                    subprocess.run(("synapse_port_db", 
                                    "--sqlite-database", sqlite3_path,
                                    "--postgres-config", migration_config_path),
                                   check=True)

                    print(f"Removing {migration_config_path} ...")
                    os.unlink(migration_config_path)
                    
                    print("Migrating pubhubs-specific tables ...")
                    with contextlib.ExitStack() as exit_stack:
                        sqlite_conn = exit_stack.enter_context(sqlite3.connect(sqlite3_path))
                        pg_conn = exit_stack.enter_context(psycopg2.connect("postgresql://synapse@localhost:5432/hub"))
                        self.migrate_ph_tables(sqlite_conn=sqlite_conn, pg_conn=pg_conn)

                    print(f"Renaming {sqlite3_path} -> {sqlite3_backup_path} ...")
                    os.rename(sqlite3_path, sqlite3_backup_path)
                    print("Migration to postgres completed!", flush=True)
                    # flushing here to make sure Synapse's output comes after

        self._waiter.add("synapse", subprocess.Popen(("/start.py",)))

        self._waiter.wait()
        print("waiting for 10 seconds to kill all remaining processes")
        time.sleep(10)

    def migrate_ph_tables(self, sqlite_conn, pg_conn):
        sqlite_cur = sqlite_conn.cursor()
        pg_cur = pg_conn.cursor()

        for table_name in ('allowed_to_join_room', 'secured_rooms', 'joined_hub'):
            print(f"Migrating table {table_name} ...")
            sqlite_cur.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name=?", (table_name,))
            sql = sqlite_cur.fetchone()[0]
            print(f"Executing in postgres: {sql} ...")
            pg_cur.execute(sql)

            sqlite_cur.execute(f"SELECT * FROM {table_name}")

            rows = sqlite_cur.fetchall()

            column_names = [desc[0] for desc in sqlite_cur.description]
            cols = ', '.join(column_names)
            placeholders = ', '.join(("%s",)*len(column_names))

            sql = f"INSERT INTO {table_name} ({cols}) VALUES ({placeholders})"
            print(f"Executing in postgres: {sql} ...")
            pg_cur.executemany(sql, rows)

        # Without the following fix Synapse fails with an error such as:
        #
        #    Postgres sequence 'device_inbox_sequence' is inconsistent with associated stream position
        #    of 'to_device' in the 'stream_positions' table.
        # 
        # See also <https://github.com/element-hq/synapse/issues/18544>
        #
        # This is probably because synapse_port_db computes device_inbox_sequence incorrectly.
        #
        # The fix (hopefully) is to set device_inbox_sequence manually the same way it is checked:
        #   <https://github.com/element-hq/synapse/blob/v1.146.0/synapse/storage/util/sequence.py#L153>
        #
        # This problem occurs not only for the device_inbox_sequence-to_device sequence-stream pair,
        # but also for other sequence-streams pairs.
        #
        # All potential sequence-stream pairs (according to claude, beware!) are listed below.
        # Only the ones that actually cause a problem are uncommmented.
        STREAM_TO_SEQUENCE = {
            "account_data":                   "account_data_sequence",
            #"caches":                         "cache_invalidation_stream_seq",
            #"device_lists_stream":            "device_lists_sequence",
            #"e2e_cross_signing_keys":         "e2e_cross_signing_keys_sequence",
            #"events":                         "events_stream_seq",
            #"presence_stream":                "presence_stream_sequence",
            #"push_rules_stream":              "push_rules_stream_sequence",
            "pushers":                        "pushers_sequence",
            "receipts":                       "receipts_sequence",
            #"thread_subscriptions":           "thread_subscriptions_sequence",
            "to_device":                      "device_inbox_sequence",
            #"un_partial_stated_event_stream": "un_partial_stated_event_stream_sequence",
            #"un_partial_stated_room_stream":  "un_partial_stated_room_stream_sequence",
        }

        for stream_name, seq_name in STREAM_TO_SEQUENCE.items():
            sql = ( f"SELECT setval('{seq_name}', "
                     "GREATEST( "
                      f"(SELECT last_value FROM {seq_name}), "
                       "(SELECT COALESCE(MAX(stream_id), 1) "
                                "FROM stream_positions "
                                "WHERE stream_name = %s)"
                             ")    )" )

            print(f"Executing in postgres: {sql} on {stream_name} ...")
            pg_cur.execute(sql, (stream_name,))

        pg_conn.commit()


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
