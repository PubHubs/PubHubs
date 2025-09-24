# PubHubs commands

Run these with the following command: `mask run [command name]` (ex. `mask run global`).

Make sure you have [mask](https://github.com/jacobdeichert/mask) installed.

## run

Commands for running the development environment.

### global-client

Runs the global client

```sh
( cd global-client && echo "Running Global client..." && npx vite --host -l info --port=8080)
```

### hub-client

Runs the hub client

```sh
( cd hub-client && echo "Running Hub client..." && npx vite --port=8008 )
```

### pubhubs

Runs the global pubhubs server

```sh
( cd pubhubs && echo "Running global server..." && cargo run serve)

if [[ -n "$test_file" ]]; then
    echo "Run tests in $test_file..."
else
    echo "Running all tests...."
fi
```

### pubhubs-hub

Runs the hub client

```sh
( cd hub-client && echo "Running Hub client..." && npx vite --port=8008 )
```