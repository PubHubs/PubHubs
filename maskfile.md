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

### hub-client

> Runs the hub client

```sh
cd hub-client
echo "Running Hub client..."
npx vite --port=8008
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

### pubhubs-hub

> Runs the hub client

```sh
cd hub-client
echo "Running Hub client..."
npx vite --port=8008 )
```
