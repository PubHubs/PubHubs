#!/usr/bin/env python3

import argparse
import subprocess
import update_config
import os
import sys
import signal
import shutil
import time
import yaml
import sqlite3
import psycopg2
import contextlib
import atexit
import collections

# The embedded postgres data directory.
PG_DATA_DIR = "/data/postgres"

# How long _stop_all waits, in total, for the services to exit cleanly on shutdown.
# Kept under docker's default 10s stop grace so postgres can finish (and remove its
# postmaster.pid) before docker escalates to an uncatchable SIGKILL.
STOP_GRACE = 8

# A long-running child process and how to stop it: `stop` is a callable invoked with
# `proc` to shut the service down cleanly.
Service = collections.namedtuple("Service", ("name", "proc", "stop"))


def _terminate(proc):
    """Default service stopper: request a clean exit via SIGTERM (non-blocking;
    _stop_all waits for the actual exit)."""
    proc.terminate()

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
                        help="Overwrites the hub server url (public_baseurl) in the homeserver configuration")
    parser.add_argument("--global-client-url", default=None,
                        help="Overwrites the global client url in the homeserver configuration")
    parser.add_argument("--replace-sqlite3-by-postgres",
                        help="Replaces the configured sqlite3 database by a postgres database running inside this container."
                             "Performs a migration, if necessary, moving homeserver.db to homeserver.db.bak "
                             "to indicate a successful migration.  Will abort when a postgres data directory is present, "
                             "but homeserver.db.bak is not.",
                        action=argparse.BooleanOptionalAction,
                        default=True)
    parser.add_argument("--server-name", default=None,
                        help="Overwrites server_name; useful when running a copy of a production server locally.")

    Program(parser.parse_args()).run()


class Program:
    def __init__(self, args):
        self._args = args
        # Long-running services, in start order.
        self._services = []

    def run(self):
        # start_hub.py is the container's PID 1.  Line-buffer our own stdout so progress
        # and shutdown lines reach `docker logs` promptly.  This governs only this
        # script's handful of print()s; the children -- synapse in particular -- write to
        # the shared fd through their own logging and are unaffected by this setting.
        sys.stdout.reconfigure(line_buffering=True)

        # The kernel drops signals that we have installed no handler for, so docker
        # stop's SIGTERM would be ignored until it escalates to an uncatchable SIGKILL.
        # Turn the stop signals into a normal interpreter exit so the atexit cleanup runs.
        # (SIGKILL still can't be caught; the services are then SIGKILLed -- harmless
        # beyond a slower next boot for postgres.)
        signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
        signal.signal(signal.SIGINT, lambda *_: sys.exit(0))

        # A stop signal during _setup() -- e.g. mid sqlite->postgres migration -- also
        # exits 0, which looks successful despite leaving a half-done migration.  We
        # accept that: the next boot refuses a data-dir-present-but-no-.bak state (the
        # guard in _run_postgres) rather than serving a half-migrated database.  Recovery
        # is manual (the guard prints the steps); this exit code does not affect that.

        # Clean up however we leave: normal exit, a stopped service, an exception, or a
        # stop signal (all of which now run atexit).
        atexit.register(self._stop_all)

        self._setup()
        names = self._wait_for_exits()
        print(f"{', '.join(names)} exited; shutting down ...")
        sys.exit(1)

    def _start(self, name, args, stop=_terminate, **popen_kwargs):
        """Start a long-running service and track it so we can wait on and stop it.

        `stop` is called with the service's Popen to shut it down cleanly; it defaults to
        SIGTERM (_terminate).
        """
        proc = subprocess.Popen(args, **popen_kwargs)
        self._services.append(Service(name, proc, stop))
        return proc

    def _wait_for_exits(self):
        """Block until one or more services exit, then return all their names.

        A plain poll loop -- no threads.  A stop signal interrupts the sleep and exits
        via atexit.  One second of latency to notice a crash is fine for a supervisor.
        Returning every process that died within the same poll tick avoids blaming an
        arbitrary one when several go down together.

        We poll only our own tracked services and deliberately do NOT waitpid(-1) to reap
        arbitrary reparented orphans.  As PID 1 we *could* collect zombies from orphaned
        grandchildren, but the kernel reaps the whole PID namespace on container exit, and
        nothing in this tree orphans children at a meaningful rate (sudo wrappers are reaped
        by subprocess.run, the postmaster reaps its own backends), so a reaper / tini is not
        worth it.  Don't be tempted to add one without first seeing real <defunct> buildup.
        """
        while True:
            dead = [s.name for s in self._services if s.proc.poll() is not None]
            if dead:
                return dead
            time.sleep(1)

    def _stop_all(self):
        """Best-effort clean stop of every running service (atexit handler).

        Two phases: first ask each service to stop, in reverse start order with a short
        pause between each so a dependent (synapse) starts releasing its connections before
        the service it depends on (postgres) is stopped; then wait -- bounded by STOP_GRACE
        in total -- for them all to exit.  The stop() calls themselves are non-blocking.

        Best effort, not a guarantee: whatever is still alive when STOP_GRACE elapses (or
        when we exit) is left to the kernel SIGKILL as the PID namespace is torn down -- at
        worst a slower next boot for postgres, never corruption.  The stops are issued one
        at a time with a pause between them (below, so synapse releases its connections
        before postgres goes away), and we do not block stop signals during teardown -- so a
        second SIGTERM/Ctrl-C raises through this handler and can cut teardown short before
        every service, postgres included, has been asked to stop.  Accepted: the normal
        single-signal stop runs the full teardown.
        """
        # Start the clock before issuing the stops: those should not block, but if one
        # ever does, that time still counts against the grace rather than extending it.
        deadline = time.monotonic() + STOP_GRACE
        for s in reversed(self._services):
            if s.proc.poll() is not None:
                continue
            print(f"Stopping {s.name} ...")
            # Never let one service's stopper abort the teardown of the others: a raising
            # stop() (e.g. a spawn failure inside _stop_postgres) would otherwise propagate
            # out of this atexit handler and skip every remaining stop and wait.
            try:
                s.stop(s.proc)
            except Exception as e:
                print(f"WARNING: stopping {s.name} raised {e!r}; continuing teardown.")
            # Give each service a moment to act on the stop -- and, for synapse, to begin
            # releasing its postgres connections -- before stopping the one it depends on.
            time.sleep(0.5)

        for s in self._services:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                still_running = [t.name for t in self._services if t.proc.poll() is None]
                print(f"WARNING: shutdown grace ({STOP_GRACE}s) elapsed; leaving "
                      f"{', '.join(still_running)} to the kernel SIGKILL.")
                break
            with contextlib.suppress(subprocess.TimeoutExpired):
                s.proc.wait(timeout=remaining)

    def _stop_postgres(self, pg_bindir):
        """Ask postgres for a clean fast shutdown via pg_ctl, without blocking.

        -m fast disconnects sessions, checkpoints, removes postmaster.pid, and exits.
        --no-wait makes pg_ctl deliver the shutdown request and return immediately;
        _stop_all then waits (bounded, alongside the other services) for the postmaster to
        actually exit.  A bare SIGTERM would instead trigger a "smart" shutdown that waits
        for clients -- see the stop= comment where postgres is started.
        """
        result = subprocess.run(("sudo", "-u", "postgres",
                        os.path.join(pg_bindir, "pg_ctl"),
                        "stop", "-D", PG_DATA_DIR, "-m", "fast", "--no-wait"),
                       stdin=subprocess.DEVNULL)
        if result.returncode != 0:
            print(f"WARNING: pg_ctl stop exited {result.returncode}; "
                  "postgres may not have shut down cleanly.")

    def _setup(self):
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

        # Decide -- before generating the live config -- whether to run synapse on the
        # embedded postgres this boot, because that choice is exactly what update_config
        # encodes into the live config (a postgres `database` section, or the original sqlite
        # one left untouched).  "..._now" marks it as the per-boot decision, distinct from the
        # standing --replace-sqlite3-by-postgres intent: a fresh hub keeps running on sqlite
        # until its database is ready, then migrates automatically on a later boot.
        with open(old_config_path) as f:
            sqlite3_path = update_config.sqlite3_path_in(yaml.safe_load(f) or {})

        replace_sqlite3_by_postgres_now = False
        if self._args.replace_sqlite3_by_postgres and sqlite3_path is not None:
            if os.path.exists(PG_DATA_DIR) or os.path.exists(sqlite3_path + '.bak'):
                # Already migrated (or a migration was at least started): postgres is the live
                # database, never sqlite.  _run_postgres re-checks the data-dir/.bak invariants
                # and refuses if the migrated data has gone missing.
                replace_sqlite3_by_postgres_now = True
            elif os.path.exists(sqlite3_path):
                # Migrate only once synapse has drained its background updates -- synapse_port_db
                # refuses while any are pending, and a brand-new database always has some.
                replace_sqlite3_by_postgres_now = self._sqlite_background_updates_done(sqlite3_path)

        update_config.run(input_file=old_config_path,
                          output_file=live_config_path,
                          environment=self._args.environment,
                          hub_client_url=self._args.hub_client_url,
                          hub_server_url=self._args.hub_server_url,
                          global_client_url=self._args.global_client_url,
                          replace_sqlite3_by_postgres=replace_sqlite3_by_postgres_now,
                          server_name=self._args.server_name)

        # Start LiveKit server.
        # Priority:
        # 1) LIVEKIT_CONFIG_PATH env var
        # 2) new local default path
        # 3) legacy path kept for backward compatibility with older images
        livekit_config_path = os.environ.get("LIVEKIT_CONFIG_PATH")
        if not livekit_config_path:
            if os.path.exists("/conf/livekit.local.yaml"):
                livekit_config_path = "/conf/livekit.local.yaml"
            else:
                livekit_config_path = "/conf/livekit.yaml"
        self._start("livekit", ("/usr/bin/livekit-server",
                        "--config", livekit_config_path))

        self._start("yivi", ("/usr/bin/irma",
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
                        "--client-port", "8088"))

        if self._args.environment == "development":
            os.putenv("AUTHLIB_INSECURE_TRANSPORT", "for_development_only_of_course")

        # Either run synapse on the embedded postgres (migrating into it the first boot the
        # sqlite database is ready) or run synapse directly on the configured sqlite.  When
        # postgres is configured in homeserver.yaml directly, sqlite3_path is None and both
        # branches are skipped: there is nothing to migrate, so leave it to Synapse.
        if replace_sqlite3_by_postgres_now:
            self._run_postgres(sqlite3_path, live_config_path)
        elif sqlite3_path is not None:
            # Synapse will run on sqlite.  Refuse the one dangerous case: a missing db
            # alongside a .bak means this hub already migrated to postgres, so starting on
            # sqlite would serve an empty hub.  (Reached only with --no-replace-sqlite3-by-
            # postgres; with the flag on, a present .bak routes us to postgres above.)
            if not os.path.exists(sqlite3_path) and os.path.exists(sqlite3_path + '.bak'):
                print(f"ERROR: {sqlite3_path} is missing but {sqlite3_path}.bak exists —")
                print( "       this hub was already migrated to postgres. Starting now would")
                print( "       create an EMPTY sqlite database. Refusing.")
                print( "       To keep using the migrated postgres database, pass --replace-sqlite3-by-postgres.")
                print(f"       To go back to the pre-migration database, restore {sqlite3_path} from its .bak")
                print( "       (any changes since the migration are in postgres, not in the backup).")
                sys.exit(1)

            # Optimize an existing database (don't create one that isn't there); this makes
            # some Synapse queries significantly faster.
            if os.path.exists(sqlite3_path):
                print("Running PRAGMA optimize on SQLite database ...")
                with sqlite3.connect(sqlite3_path) as conn:
                    conn.execute("PRAGMA optimize;")
                print("PRAGMA optimize complete.")

        self._start("synapse", ("/start.py",))

    def _sqlite_background_updates_done(self, sqlite3_path):
        """True iff `sqlite3_path` is an initialised synapse database with no pending
        background updates -- the precondition synapse_port_db enforces before migrating
        (it aborts with "Pending background updates exist ..." otherwise).  Opened read-only,
        so it never creates the database (nor leaves a root-owned -wal/-shm behind)."""
        try:
            with contextlib.closing(
                    sqlite3.connect(f"file:{sqlite3_path}?mode=ro", uri=True)) as conn:
                (pending,) = conn.execute("SELECT count(*) FROM background_updates").fetchone()
        except sqlite3.DatabaseError:
            # Missing/locked/corrupt file, or no background_updates table yet: not a ready
            # synapse database.  Run synapse on sqlite; migrate later.
            return False
        if pending:
            print(f"{sqlite3_path} has {pending} pending background update(s); running synapse "
                  "on sqlite and deferring the postgres migration until they finish.")
        return pending == 0

    def _run_postgres(self, sqlite3_path, live_config_path):
        """Run a postgres server inside this container, migrating the configured
        sqlite3 database into it on first run.

        `sqlite3_path` is the original sqlite3 database path (update_config has
        already rewritten the live config to point at postgres instead).  On a
        successful migration it is renamed to `<path>.bak`, which doubles as the
        "migration succeeded" marker.
        """
        # NOTE: postgres command have a bad habit of changing TTY options, such as 'onlcr', so
        # that the terminal output looks
        #                               like this, because \n is no longer
        #                                                                 translated to \r\n.
        # Setting stdin=subprocess.DEVNULL seems to prevent this.

        # find postres executable path
        pg_data_dir = PG_DATA_DIR
        pg_bindir = subprocess.run(('sudo', '-u', 'postgres',
                                 'pg_config', '--bindir'),
                                stdin=subprocess.DEVNULL,
                                check=True, capture_output=True).stdout.strip().decode('utf-8')

        sqlite3_backup_path = sqlite3_path + '.bak'

        # A completed migration renamed homeserver.db to .bak.  If that marker is
        # present but the postgres data directory is gone, the migrated data was
        # removed: starting now would build a fresh empty cluster and silently serve
        # an empty hub.  Refuse *before* initdb — otherwise the next boot would treat
        # the freshly-created empty cluster as a valid, already-migrated postgres.
        if not os.path.exists(pg_data_dir) and not os.path.exists(sqlite3_path) \
                and os.path.exists(sqlite3_backup_path):
            print(f"ERROR: {pg_data_dir} is missing but {sqlite3_backup_path} (a completed-migration")
            print( "       marker) is present. The migrated postgres data was removed; starting now")
            print( "       would create an EMPTY database. Refusing.")
            print(f"       To recover all data, restore {pg_data_dir} from a backup.")
            print( "       To re-migrate from the pre-migration snapshot (losing changes since the")
            print(f"       migration), rename {sqlite3_backup_path} back to {sqlite3_path}.")
            print(f"       To wipe the hub and start fresh, remove {sqlite3_backup_path} too.")
            sys.exit(1)

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
        postgres_process = self._start("postgres",
                         ('sudo', '-u', 'postgres',
                          os.path.join(pg_bindir, "postgres"),
                          '-D', pg_data_dir,
                          # Tuning: don't have postgres wait for data to be written to disk.
                          # Risks loss of the last transaction, but there's no risk
                          # of corruption.
                          # <https://www.postgresql.org/docs/current/wal-async-commit.html>
                          '-c', 'synchronous_commit=off',
                          # When more tuning is needed:
                          #  - <https://element-hq.github.io/synapse/latest/postgres.html#tuning-postgres>
                          #  - <https://pgtune.leopard.in.ua/>
                          ),
                         # postgres runs under sudo, but a bare SIGTERM reaches the
                         # postmaster (sudo relays it) as a "smart" shutdown that waits for
                         # clients to disconnect.  synapse does quit on its own SIGTERM
                         # (signalled first), but its graceful shutdown can take several
                         # seconds and _stop_all doesn't wait for it to finish before
                         # stopping postgres -- so a smart shutdown could outlast docker's
                         # grace and be SIGKILLed, leaving a stale lock file.  A "fast"
                         # shutdown is prompt and independent of synapse, so we use that.
                         stop=lambda proc: self._stop_postgres(pg_bindir),
                         stdin=subprocess.DEVNULL)
        countdown = 300
        while True:
            # Check for a dead postgres before the timeout, so a crash -- e.g. a stale
            # postmaster.pid from a previous unclean shutdown, a bad config, or wrong
            # permissions on the data directory -- is reported as postgres's own error
            # rather than misreported as a timeout, even when it dies on the last iteration.
            if postgres_process.poll() is not None:
                raise RuntimeError(f"postgres exited with code {postgres_process.returncode} before "
                                   "becoming ready; see its error output above")
            if subprocess.run(("sudo", "-u", "postgres", "pg_isready", "-q"),
                              stdin=subprocess.DEVNULL).returncode == 0:
                break
            if countdown == 0:
                raise RuntimeError("postgres server did not start properly; the reason might be in the logs above")
            print(f"Waiting {countdown} seconds for the postgres server to come up ...")
            time.sleep(1)
            countdown -= 1

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

                config_dir = os.path.dirname(os.path.abspath(live_config_path))
                print(f"Running vanilla Synapse migration {sqlite3_path} -> postgres (this might take a while!) ...")
                subprocess.run(("synapse_port_db",
                                "--sqlite-database", os.path.abspath(sqlite3_path),
                                "--postgres-config", os.path.abspath(migration_config_path)),
                               cwd=config_dir,
                               check=True)

                print(f"Removing {migration_config_path} ...")
                os.unlink(migration_config_path)

                print("Migrating pubhubs-specific tables ...")
                with contextlib.ExitStack() as exit_stack:
                    sqlite_conn = exit_stack.enter_context(sqlite3.connect(sqlite3_path))
                    pg_conn = exit_stack.enter_context(psycopg2.connect(host='/var/run/postgresql', user='synapse', dbname='hub'))
                    self.migrate_ph_tables(sqlite_conn=sqlite_conn, pg_conn=pg_conn)

                print(f"Renaming {sqlite3_path} -> {sqlite3_backup_path} ...")
                os.rename(sqlite3_path, sqlite3_backup_path)
                print("Migration to postgres completed!")

        # Force a checkpoint so that PostgreSQL does not run it in the
        # background while Synapse is already serving clients, which would
        # saturate I/O and block database connections for minutes.
        print("Running CHECKPOINT before starting Synapse ...")
        subprocess.run(("sudo", "-u", "postgres", "psql", "--dbname=hub",
                        "-c", "CHECKPOINT"),
                       stdin=subprocess.DEVNULL, check=True)
        print("CHECKPOINT complete.")

    def migrate_ph_tables(self, sqlite_conn, pg_conn):
        sqlite_cur = sqlite_conn.cursor()
        pg_cur = pg_conn.cursor()

        for table_name in ('allowed_to_join_room', 'secured_rooms', 'joined_hub'):
            sqlite_cur.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name=?", (table_name,))
            row = sqlite_cur.fetchone()
            if row is None:
                # These tables are created by the hub's synapse modules at runtime, not by
                # synapse itself, so a migration source that predates them lacks them.  The
                # modules recreate them idempotently (CREATE TABLE IF NOT EXISTS) on first
                # boot, so skipping is safe.
                print(f"Table {table_name} not present in the source database; skipping.")
                continue
            print(f"Migrating table {table_name} ...")
            sql = row[0]
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

        # --- Fix Synapse's postgres sequences so it can start after the migration ---
        #
        # If this is missing or incomplete, Synapse refuses to start after a migration with:
        #
        #     Postgres sequence '..._sequence' is inconsistent with associated stream
        #     position of '...' in the 'stream_positions' table.
        #
        # Why it happens: the standard `synapse_port_db` tool sets each sequence from the
        # highest id still present in its table.  But Synapse deletes rows as it runs
        # (to-device messages once delivered, old receipts, data of deactivated users, ...),
        # so the highest *remaining* id can be lower than the highest id Synapse ever handed
        # out.  Synapse remembers the latter in the `stream_positions` table and refuses to
        # start when a sequence is below it.  This is an open Synapse bug:
        #   <https://github.com/element-hq/synapse/issues/18544>
        #
        # The fix below raises each sequence up to at least its recorded stream position.
        # It is safe: it never lowers a sequence and does nothing when one is already fine.
        #
        # The list is one entry per Synapse sequence, for the Synapse version this image is
        # built on.  If a future Synapse version prints the error above for a sequence that
        # is NOT in the list, just add it -- the error message gives you both halves:
        #     "sequence 'X' ... position of 'Y'"   ->   add   "Y": "X"
        # Do NOT add the "backfill" stream (events_backfill_stream_seq): it counts
        # downwards, so this fix would make it worse.
        STREAM_TO_SEQUENCE = {
            "account_data":                   "account_data_sequence",
            "caches":                         "cache_invalidation_stream_seq",
            "device_lists_stream":            "device_lists_sequence",
            "e2e_cross_signing_keys":         "e2e_cross_signing_keys_sequence",
            "events":                         "events_stream_seq",
            "presence_stream":                "presence_stream_sequence",
            "push_rules_stream":              "push_rules_stream_sequence",
            "pushers":                        "pushers_sequence",
            "receipts":                       "receipts_sequence",
            "sticky_events":                  "sticky_events_sequence",
            "thread_subscriptions":           "thread_subscriptions_sequence",
            "to_device":                      "device_inbox_sequence",
            "un_partial_stated_event_stream": "un_partial_stated_event_stream_sequence",
            "un_partial_stated_room_stream":  "un_partial_stated_room_stream_sequence",
        }

        for stream_name, seq_name in STREAM_TO_SEQUENCE.items():
            # Skip sequences that don't exist in this Synapse version.
            pg_cur.execute("SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = %s", (seq_name,))
            if pg_cur.fetchone() is None:
                print(f"Sequence {seq_name} does not exist in this Synapse version; skipping.")
                continue

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


if __name__ == "__main__":
    main()
