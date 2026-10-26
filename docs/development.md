# Development

Everything runs on your own computer: PubHubs Central, the global client, Yivi, and up to five test
hubs. If you only work on the hub client, you can also run it against the staging hub instead, see
[Only the hub client](#only-the-hub-client).

- [Setup](#setup)
- [Running PubHubs](#running-pubhubs)
- [Logging in with Yivi](#logging-in-with-yivi)
- [Making yourself admin](#making-yourself-admin)
- [Only the hub client](#only-the-hub-client)
- [On a phone](#on-a-phone)
- [Checks and tests](#checks-and-tests)
- [Hub database changes](#hub-database-changes)

## Setup

`main` is the development branch, `stable` is what runs in production. Merge a branch that other
branches build on with a merge commit, not squashed: the branches built on its original commits then
meet the same changes twice, and every file they changed after it conflicts.

```sh
nix develop      # every tool, except Docker
mask run init    # check versions, set up the S3 storage and build the test hubs (also wipes them)
npm install      # the clients' packages, and the pre-commit hook that formats your code
```

Docker is needed either way. Without Nix you also need [Node.js](https://nodejs.org) 22 or newer,
Rust through [rustup](https://rustup.rs), Python 3.12 or newer, [tmux](https://github.com/tmux/tmux)
and [Mask](https://github.com/jacobdeichert/mask); `flake.nix` has the exact list.

On Windows, run everything in Git Bash, and run the lines of `scripts/run-all.sh` one by one, as
there is no tmux. Turn off Git's line ending conversion before you clone, or the shell scripts
break: `git config --global core.autocrlf false`.

[`maskfile.md`](../maskfile.md) has every development command. `mask --help` lists them.

## Running PubHubs

```sh
mask run all
```

This starts everything in a tmux session called `pubhubs`, and stops it all again when you leave the
session. Open <http://localhost:8080>.

| Command                   | What it runs                                                         | Port             |
| ------------------------- | -------------------------------------------------------------------- | ---------------- |
| `mask run yivi`           | The Yivi server                                                      | 8188, 8189       |
| `mask run s3`             | Garage, the S3 storage for PubHubs Central                           | 3900             |
| `mask run servers`        | PubHubs Central: PHC, the authentication server and the transcryptor | 5050, 6060, 7070 |
| `mask run client`         | The global client                                                    | 8080             |
| `mask run hub server <n>` | Test hub `n`, 0 to 4, with its LiveKit on `7880+n`                   | `8008+n`         |
| `mask run hub client <n>` | The hub client for test hub `n`                                      | `8001+n`         |

`mask run all` starts hub 0; start more with the commands above, in another terminal. A hub that has
just started shows as "under construction" in the global client until it answers. If the tmux
session gets stuck, `mask run all cleanup` ends it.

**Configuration.** PubHubs Central reads `pubhubs/pubhubs.default.toml`. To change it, copy it to
`pubhubs/pubhubs.toml` (git ignores it) and change the copy. Test hub `n` runs from
`pubhubs_hub/testhub<n>/`, a copy of `pubhubs_hub/matrix_test_config/` made by `mask run init`.

**The hub database.** A new test hub runs on SQLite. On a later start, once Synapse has finished its
background updates, it moves to a PostgreSQL inside its container, and renames `homeserver.db` to
`homeserver.db.bak`. To stay on SQLite, use `mask run hub server <n> --no-postgres` (or
`mask run all --no-postgres`). For a hub that has already moved, first rename `homeserver.db.bak`
back to `homeserver.db`; changes made since the move are only in PostgreSQL.

## Logging in with Yivi

You log in with the [Yivi app](https://yivi.app) on your phone, which has to reach your computer:

1. **Turn on developer mode** in Yivi, so it accepts plain HTTP: tap the app id in the **More** menu
   a few times ([how](https://irma.app/docs/yivi-app/#developer-mode)). Without it, Yivi says the
   server doesn't use HTTPS.
2. **Put your phone on the same network** as your computer, and allow Yivi to use the local network.
3. **Let the ports in.** A firewall on your computer must let ports 8008 (and `8008+n` for more
   hubs), 8080, 8188 and 8189 through. To check, run `nmap <your IP address>` from another machine
   and look for `filtered`.

PubHubs Central, the Yivi server and the test hubs find your computer's network address themselves
(the `networkhost` in `pubhubs.default.toml`). If they guess wrong, for example with a VPN, set it
for the Yivi server and the test hubs:

```sh
YIVI_HOST=192.168.0.2 mask run all
```

and to the same address for PubHubs Central, in `pubhubs/pubhubs.toml`, because a hub's address must
match the one PubHubs Central gives out for it:

```toml
[host_aliases]
networkhost.ip = "192.168.0.2"
```

A hub you start yourself, without `mask run hub server` (which runs `start_testhub.py`), needs
`public_yivi_url` in its `homeserver.yaml` set to your computer's address as well: Yivi can't reach
`localhost` on your computer.

If Yivi still says to check your phone's internet connection:

- **The network keeps devices apart**, as eduroam does. Connect your phone and computer with
  [Tailscale](https://tailscale.com) and use the computer's Tailscale address.
- **Your computer is behind a NAT** that your phone isn't (the address your computer reports differs
  from the one <https://ifconfig.me> shows), and you can't forward ports. With a server that has a
  public address, forward the ports over SSH (`ssh -R 8080:localhost:8080 you@server`, and so on)
  and use the server's address.
- **iCloud Private Relay** sends an iPhone's traffic through Apple. Turn it off, or turn off _Limit
  IP Address Tracking_ for your Wi-Fi network.

If the browser complains about CORS, turn off HTTPS-only mode for `localhost`.

## Making yourself admin

A new test hub has no rooms and no admins. Log in to the hub once, then make every user admin (or
add `WHERE name = '@...'`) and restart the hub:

```sh
# a hub on SQLite: no homeserver.db.bak in pubhubs_hub/testhub0/
sqlite3 pubhubs_hub/testhub0/homeserver.db 'UPDATE users SET admin = 1;'

# a hub on PostgreSQL
docker exec -it pubhubs-testhub0 sudo -u postgres psql hub -c 'UPDATE users SET admin = 1;'
```

Use `sudo` for `sqlite3` if the file belongs to the container. On a real hub it works the same, see
[Running a hub](running-a-hub.md#making-the-first-admin).

## Only the hub client

Run the hub client against the staging hub (`main.testhub-matrix.ihub.ru.nl`), without anything
else:

```sh
mask run hub mainclient         # the hub client on port 8001
mask run hub mainclient enter   # in another terminal: log in with Yivi, and get a link with an access token
```

`npm run serve` in `hub-client/` starts the Vite server by hand; set `VITE_HUB_URL` to the hub it
should use. [Hub client](hub-client.md) explains how the client is put together.

## On a phone

With an Android phone connected over USB, with USB debugging on, `mask run android ports` forwards
every port to it, so `localhost:8080` works in the phone's browser. Read its console in
`chrome://inspect` in Chrome, or `about:debugging` in Firefox.

A test hub gives out its client on your computer's network address, which a phone can reach, and
also accepts that client from `localhost`: `start_testhub.py` passes `--hub-dev-url`, which becomes
the hub's `dev_url`. Without it, the hub's own endpoints (consent, hub settings) would refuse a
browser on `localhost`, and you would be stuck on the house rules.

For the Android and iOS app, see [the app](app/README.md).

## Checks and tests

```sh
mask check all     # formatting, linting and types for the clients, and tool versions
mask lint          # format and lint the clients, fixing what can be fixed
mask test all      # the clients, the hub modules and PubHubs Central
mask check audit   # npm packages against known advisories
```

`mask test client`, `mask test hub` and `mask test servers` run one part. Without Nix,
`mask test hub` needs `pip install -r pubhubs_hub/requirements.txt` first, in a virtualenv. For
PubHubs Central, CI also runs `cargo clippy --all-targets -- --deny warnings` and `cargo deny check`
in `pubhubs/`. The pipeline is in `cicd/.gitlab-ci.yml`.

The pre-commit hook formats staged files. If `cargo` says `rustc` is too old, run `rustup update`.

The end-to-end tests are in the separate
[pubhubs-e2e-test](https://gitlab.science.ru.nl/pubhubs/pubhubs-e2e-test) repository. To run them
against your own computer, set `LOCAL=true` in its `.env`, with two different users for
`USERAUTH` and `ADMINAUTH`: with the same account for both, the setup fails on power levels.
`npm run capture-hub-session -- --target=local --user=user` captures a user; it looks for the hub
frame by `CLIENT_URL`, so for the capture set that to the hub client's network address (for example
`CLIENT_URL=http://192.168.0.2:8001`).

## Hub database changes

The PubHubs modules keep their own tables in the hub's database. To add, remove or rename a column,
add a rule to `DBMigration` in `pubhubs_hub/modules/pubhubs/DBMigration.py`, which runs when the hub
starts, on SQLite and PostgreSQL alike:

```python
self.migration = StoreModifier(api, AddColumnsMigrationStrategy())
column_info = ("expiration_time_days", "TEXT NOT NULL DEFAULT 182")
run_in_background(self.migration.modify, 'secured_rooms', column_info)
```

The strategies are in `_store_modifier.py` and their SQL in `_database_commands.py`; a new kind of
change needs a new strategy there.
