# PubHubs commands for local development

To run the commands in this file, please make sure you have [Mask](https://github.com/jacobdeichert/mask) installed, as well as all the dependencies in the [Nix flake](./flake.nix). If using the Nix devshell, these are already included.

To run the commands in this file, you can do `mask run <command name>`.
You can see all available commands by running `mask help` or `mask <command> help`.

> For Windows users, make sure you run these commands in bash (such as [Git Bash](https://git-scm.com/install/windows), which should be installed with Git by default).

> Shell snippets in this file should stick to POSIX syntax so they keep working in Git Bash, MSYS, and WSL alongside Linux/macOS shells.

---

## run

> Commands for running the development environment

### all

> Runs everything in a TMUX session

This requires [tmux](https://github.com/tmux/tmux) to be installed.

> Windows users should run the lines in `scripts/run-all.sh` separately, as TMUX is not available on Windows.

**OPTIONS**

- no_postgres
    - flags: --no-postgres
    - desc: Passed through to the hub server pane, see `mask run hub server`'s --no-postgres.

```sh
PH_NO_POSTGRES="$no_postgres" sh scripts/run-all.sh
```

#### cleanup

> Kills everything in the TMUX session.

```sh
sh scripts/run-all-cleanup.sh
```

---

### init

> Initializes/wipes the development environment

**OPTIONS**

- no_check
    - flags: --no-check
    - desc: Skip version checks

```bash
set -e
echo "Running setup"

[[ "$no_check" != "true" ]] && mask check versions
mask run s3 init
mask run hub init
```

### yivi

> Runs the Yivi server for the PubHubs servers

**OPTIONS**

- host
    - flags: --host
    - type: string
    - desc: Override the host IP yivi advertises in its session URL (e.g. a Tailscale IP)

```sh
echo "Running Yivi server..."

cd pubhubs
yivi_host="${host:-${YIVI_HOST:-}}"
python3 run_yivi.py ${yivi_host:+--host "$yivi_host"}
```

### s3

> Runs the Garage S3 server for the PubHubs PHC server

```sh
echo "Running Garage S3 server..."

cd pubhubs
python3 run_garage.py
```

#### init

buildkit issues docker?
buildx en buildkit for arch

> Intializes/wipes the garage storage directory

```sh
set -e
echo "removing garage data and meta directories..."

cd pubhubs
rm -rf garage/data
rm -rf garage/meta

echo "creating garage data and meta directories..."

mkdir garage/data
mkdir garage/meta
echo "starting garage for configuration..."

trap 'echo "removing garage container" && docker rm -f pubhubs-garage' EXIT INT

python3 run_garage.py --detach

# from this point onwards, we're not using any paths on the host, so we can safely
# disable windows path conversion (that would convert "/garage" to "C:/...")
export MSYS_NO_PATHCONV=1

echo "waiting for garage to initialize..."
while ! docker exec pubhubs-garage /garage status; do
  sleep .5
done

# based on https://garagehq.deuxfleurs.fr/documentation/quick-start/

echo "getting node id..."
NODE_ID="$(docker exec pubhubs-garage /garage node id)"

echo "assigning and applying layout..."
docker exec pubhubs-garage /garage layout assign -z dc1 -c 1G "$NODE_ID"
docker exec pubhubs-garage /garage layout apply --version 1

echo "creating bucket..."
docker exec pubhubs-garage /garage bucket create phc

echo "creating key..."
docker exec pubhubs-garage /garage key import --yes -n phc GK4ab65ecd61df5cd9382075c5 c46af3789d8f98b527538e4eeea6c1130e1356b694f391fa6f9af5098121e50f

echo "adding key to bucket..."
docker exec pubhubs-garage /garage bucket allow --read --write phc --key phc

echo "\033[1;32mfinished setting up garage\033[0m"
```

### servers

> Runs the global PubHubs servers

```sh
echo "Running global servers..."
cd pubhubs
cleanup() {
    if cargo sweep --version >/dev/null 2>&1; then
      echo "Sweeping pubhubs/target directory ..."
      cargo sweep --time 30
    else
      echo "TIP: to have us automatically clean up the pubhubs/target directory:"
      echo
      echo "     cargo install cargo-sweep"
      echo
    fi
    if test -n "$(jobs -p)"; then
      echo "cargo run serve is still running; killing after one second ..."
      sleep 1; kill 0
    fi
}
trap 'cleanup' EXIT
cargo run serve &
wait # wait exits on SIGINT, while cargo run serve might not
```

### client

> Runs the pubhubs global client

```sh
echo "Running pubhubs client..."

cd global-client
npx vite --host -l info --port=8080
```

### android

> Commands for Android development

To develop on an Android device:

1. Run `mask run all` to start the local environment.
2. Activate developer mode on your phone (tap Build number 10 times in Settings > About phone).
3. Enable USB debugging in Developer options.
4. Connect your phone via USB and allow USB debugging in the pop-up prompt.
5. Run `mask run android ports` to forward all required ports.
6. Open `localhost:8080` in your phone's browser.
7. To read the console: use `about:debugging` in Firefox or `chrome://inspect` in Chrome.

#### ports

> Forwards all required ports to a connected Android device via ADB

```sh
PORTS=(3900 5050 6060 7070 8001 8002 8003 8004 8008 8009 8010 8011 8012 8080 8088 8089 8188 8189)

adb devices

echo "Forwarding ports: ${PORTS[*]}"
echo "Press Ctrl+C to stop."

while true; do
  for port in "${PORTS[@]}"; do
    adb reverse tcp:$port tcp:$port 2>/dev/null
  done
  sleep 10
done
```

### hub

> Commands for running the hub

Every command below is structured as `mask run hub <subcommand>`

#### server (n)

> Runs the n-th hub server

Don't forget to build the hub image and setup the hub's directory using the
`mask run hub init` command before running the server and client command

**OPTIONS**

- no_postgres
    - flags: --no-postgres
    - desc: Keep running on sqlite instead of auto-migrating to the embedded postgres. If this hub already migrated (homeserver.db.bak present), first `mv` it back to homeserver.db — see docs/development/LOCAL_DEVELOPMENT.md.

```sh
echo "Running testhub${n}"

cd pubhubs_hub
hub_host="${host:-${YIVI_HOST:-}}"
postgres_flag=()
[[ "$no_postgres" == "true" ]] && postgres_flag=(--no-replace-sqlite3-by-postgres)
python3 start_testhub.py "${postgres_flag[@]}" "${n}"
```

#### client (n)

> Runs the n-th hub client

Don't forget to build the hub image and setup the hub's directory using the
`mask run hub init` command before running the server and client command

```sh
cd hub-client
echo "Running Hub client for testhub${n}..."
env VITE_HUB_URL=$(node -e "console.log('http://localhost:' + (8008 + $n))") npx vite --host -l info --port=$(node -e "console.log(8001 + $n)")
```

#### mainclient

> Runs the hub client (local) against the main (staging) server

Run this as a standalone command, so without the global client running.
To log in, run `mask run mainclient enter`.

```sh
cd hub-client
echo "Running Hub client for main testhub ..."
env VITE_HUB_URL=$(node -e "console.log('https://main.testhub-matrix.ihub.ru.nl')") npx vite --host -l info --port=$(node -e "console.log(8001)")
```

##### enter

> Gets the url with access token to your local client running against main

```sh
cd pubhubs
cargo run enter -e main -l testhub
echo ""
echo "Don't forget to have 'mask run hub mainclient' running"
```

#### init

> Initialize the testhubs setup

```sh
mask run hub init testhub-dirs
mask run hub init testhub-image
```

##### testhub-dirs

> Prepares directories for running the local hubs

This command is normally run via the `mask run hub init` command..

```sh
echo "Setting up testhub directories..."

cd pubhubs_hub
for i in $(seq 0 4);
do
    echo "testhub$i"
    rm -rf "testhub${i}"
    cp -r matrix_test_config "testhub$i"
    chmod 777 "testhub$i"
done
```

##### testhub-image

> Build the PubHubs hub Docker image

This command is normally run via the `mask run hub init` command.

```sh
echo  "Building hub..."

cd pubhubs_hub
docker build -t pubhubs-hub .
```

---

## lint

> Format and lint source code (applies fixes)

```sh
npm run lint
```

---

## test

> Run tests

### all

> Run every test suite: the clients, the hub's Synapse modules and PubHubs Central

```sh
set -e

mask test client
mask test hub
mask test servers
```

### client

> Run the global and hub client tests (Vitest)

```sh
set -e

npm run test:run --workspace=global-client
npm run test:run --workspace=hub-client
```

### hub

> Run the hub's Synapse module tests

Needs the Nix dev shell (`nix develop`) for the `synapse` and `livekit` imports, or
`pip install -r pubhubs_hub/requirements.txt` in a virtualenv.

```sh
set -e

cd pubhubs_hub
python3 -m unittest discover -p '*_test.py'
```

### servers

> Run the PubHubs Central tests (Rust)

Needs the Nix dev shell (`nix develop`) for `cargo`. Linting lives in `mask check`, so this
runs the tests only.

```sh
set -e

cd pubhubs
cargo test
```

---

## check

> Check source code without modifying it

### all

> Run all checks (format, lint, types) and environment versions

```sh
npm run check && mask check versions
```

### format

> Check formatting with Prettier

```sh
npm run check:format
```

### lint

> Check linting with ESLint

```sh
npm run check:lint
```

### types

> Check types with TypeScript

```sh
npm run check:types
```

### audit

> Check the npm dependencies against our security advisory policy

The npm counterpart of `cargo deny check advisories`: it fails on any `npm audit` advisory that
[scripts/npm-audit.config.mjs](scripts/npm-audit.config.mjs) does not accept. Not part of `mask check all`, because
new advisories are published all the time and one appearing should not fail an unrelated check run —
the `npm-audit` pipeline job is what watches for them. Needs no `npm install`; it reads
`package-lock.json`.

```sh
npm run check:audit ${verbose:+-- --verbose}
```

### versions

> Check whether some of the required software is installed

```sh
set -e

if ! command -v python3 >/dev/null 2>&1
then
    echo "PROBLEM: 'python3' is required to run the pubhubs locally, but was not found"
    exit 1
fi

python3 scripts/check-python3-version.py
python3 scripts/check-versions.py
```

## update

> Commands for updating pinned dependencies

### yivi (version)

> Updates the pinned Yivi (irmago) version in packages/yivi.nix

Runs `nix-update` inside a throwaway git worktree.

```sh
set -e

worktree="$(mktemp -d)/pubhubs"
git worktree add --detach -q "$worktree" HEAD
trap 'git worktree remove --force "$worktree" >/dev/null 2>&1' EXIT

cp packages/yivi.nix "$worktree/packages/yivi.nix"
(cd "$worktree" && nix run nixpkgs#nix-update -- --flake yivi --version "$version")
cp "$worktree/packages/yivi.nix" packages/yivi.nix

echo
echo "packages/yivi.nix is now at ${version}. Remaining steps:"
echo "  1. update the trailing version comment next to yivi in flake.nix"
echo "  2. keep the yivi_build stage of pubhubs_hub/Dockerfile on the same version"
echo "  3. run 'direnv reload' and check 'yivi version' (direnv only watches flake.nix and flake.lock)"
echo "  4. smoke-test with 'mask run yivi'"
```
