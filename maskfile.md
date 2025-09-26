# PubHubs commands for local development

Run these with the following command: `mask run [command name]` (ex. `mask run global`).

Make sure you have [mask](https://github.com/jacobdeichert/mask) installed.

## run

Commands for running the development environment.

### pubhubs-client

> Runs the pubhubs global client

```sh
cd global-client
echo "Running pubhubs client..."
npx vite --host -l info --port=8080
```

### pubhubs

> Runs the global PubHubs servers

```sh
cd pubhubs
echo "Running global servers..."
cargo run serve
```

#### yivi

> Runs the Yivi server for the PubHubs servers

```sh
cd pubhubs
echo "Running Yivi server..."
./yivi.sh
```

### hub-client (n)

> Runs the n-th hub client

```sh
cd hub-client
echo "Running Hub client for testhub${n}..."
VITE_HUB_URL="http://localhost:$((8008 + n))" npx vite --host --port="$((8001 + n))"
```

### hub (n)

> Runs the n-th hub server

Don't forget to build the hub image and setup the hub's directory using the 
hubs build-image` and `hubs setup-dirs` subcommands.

```sh
cd pubhubs_hub
echo "Running testhub${n}"
./start_testhub.py "${n}"
```

### all

> Run everything (WORK IN PROGRESS)

```sh
trap 'kill $(jobs -p)' EXIT	
mask run pubhubs yivi &
sleep 1
mask run pubhubs &
mask run pubhubs-client &
for i in $(0 4);
do
    mask run hub "$i" &
    mask run hub-client "$i" &
done
wait
```

### init

> Initialize test setup
```sh
mask run init testhub-dirs
mask run init testhub-image
```

#### testhub-dirs

> Prepares directories for running the local hubs

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

#### testhub-image

> Build the PubHubs hub Docker image

```sh
echo  "Building hub..."
cd pubhubs_hub
docker build -t pubhubs-hub .
```
