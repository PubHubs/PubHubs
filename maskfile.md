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

```sh
cd pubhubs_hub
echo "Running Hub..."
docker run \
    --rm \
    --name pubhubs-testhub0 \
    -p 8008:8008 \
    -v ./modules:/conf/modules:ro \
    -v ./update_config:/conf/update_config:ro \
    -v ./testhub0:/data:rw \
    --add-host host.docker.internal:host-gateway \
    -e SYNAPSE_CONFIG_DIR=/data \
    -e AUTHLIB_INSECURE_TRANSPORT=for_testing_only_of_course \
    pubhubs-hub
```

#### build

> Build the pubhubs hub docker image

```sh
echo  "Building hub..."
docker build \
    -t pubhubs-hub \
    -f pubhubs_hub/Dockerfile .
```
