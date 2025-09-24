# PubHubs commands

Run these with the following command: `mask run [command name]` (ex. `mask run global`).

Make sure you have [mask](https://github.com/jacobdeichert/mask) installed.

## run

Commands for running the development environment.

### global

Runs the global client

```sh
( cd global-client && echo "Running Global client..." && npm run vite )
```

### hub

Runs the hub client

```sh
( cd hub-client && echo "Running Hub client..." && vite --port=8008 )
```