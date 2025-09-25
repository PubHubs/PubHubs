# PubHubs commands for local development

Run these with the following command: `mask run [command name]` (ex. `mask run global`).

Make sure you have [mask](https://github.com/jacobdeichert/mask) installed.

## run

Commands for running the development environment.

### global-client

> Runs the global client

```sh
cd global-client
echo "Running Global client..."
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

### hub-client

> Runs a hub client

```sh
cd hub-client
echo "Running Hub client..."
npx vite --host -l info --port=8001
```

### hub

> Runs a hub

Don't forget to build the hub image and setup the hub's directory using the 
build-image` and `setup-dir` subcommands.

```sh
cd pubhubs_hub
echo "Running Hub..."
./start_testhub.py
```

#### setup-dir

> Prepares a directory for running the local hub

```sh
echo "Setting up testhub directory..."
cd pubhubs_hub
rm -rf testhub0
cp -r matrix_test_config testhub0
chmod 777 testhub0
```

#### build-image

> Build the PubHubs hub Docker image

```sh
echo  "Building hub..."
cd pubhubs_hub
docker build -t pubhubs-hub .
```
