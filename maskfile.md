# PunHubs commands

Run these with the following command: `mask run [command name]` (ex. `mask run global`).

Make sure you have [mask](https://github.com/jacobdeichert/mask) installed.

## run

Commands for running the development environment.

### global

Runs the global client

```sh
( cd global-client && echo "Running Global client..." && npm run watch )
```

### hub

Runs the hub client

```sh
( cd hub-client && echo "Running Hub client..." && npx vue-cli-service serve --watch --port=8801 )
```

### pubhubs

Runs PubHubs Central

```sh
( cd pubhubs && echo "Running PubHubs Central..." && cargo run )
```

### setup

Runs the setup script for setting up the docker containers for Yivi and the testserver

```sh
echo "Running setup script..." && python3 start_test_setup.py exec --cargo-disabled
```
