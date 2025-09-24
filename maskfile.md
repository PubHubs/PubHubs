# PubHubs commands for local development

Run these with the following command: `mask run [command name]` (ex. `mask run global`).

Make sure you have [mask](https://github.com/jacobdeichert/mask) installed.

## run

Commands for running the development environment.

### global-client

> Runs the global client

**OPTIONS**

- port
  - flags: -p --port
  - type: string
  - desc: Which port to serve on

```sh
PORT=${port:-8080}

( cd global-client && echo "Running Global client..." && npx vite --host -l info --port=$PORT)
```

### hub-client

> Runs the hub client

```sh
( cd hub-client && echo "Running Hub client..." && npx vite --port=8008 )
```

### pubhubs

> Runs the global pubhubs server

```sh
( cd pubhubs && echo "Running global server..." && cargo run serve)
# Docker Yivi
```

### pubhubs-hub

> Runs the hub client

```sh
( cd hub-client && echo "Running Hub client..." && npx vite --port=8008 )
```
