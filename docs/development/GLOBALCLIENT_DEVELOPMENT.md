> [!warning] Warning: outdated

# Pubhubs Global Client

The global [PubHubs](https://pubhubs.net/) client.

Build with `TypeScript`, `VueJs3` and `Tailwind`.

# Installing

For normal use this should automatically be done with the PubHubs deployment and install procedure.

For Development or Theming see below.

# Setup for development or theming

[Node](https://nodejs.org) should be present on your system.

```
npm install
```

## Localization &&

We use [Vue I18n](https://vue-i18n.intlify.dev/) for localization. Language files are in `../hub-client/src/locales`. Supported languages can be set in `./src/i18n.ts`.

## Theming and UI

Theming importerd from hub-client in: `../hub-client/src/assets/tailwind.css`.

## Development

See `../hub-client/README.md` for starting a local hub-client.

### Without hubs

First setup a development environment (see above). Then start the development server and open the given URL in the browser. This has Hot Module Replacement for fast UI development:

```
npm run serve
```

### With hubs

If you need to test and switch with hubs, start the global client with the general startup script See [LOCAL DEVELOPMENT](./LOCAL_DEVELOPMENT.md):

```
python3 start_test_setup.py run --cargo-enabled cargo run
```

This will serve the global-client from `http://localhost:8080/client/index.html`.

You can also add hubs by specifying the `--scale` flag followed by the number of hubs. For example, to have three hubs in our development setup. We can add `--scale 3` when running the script.

```
python start_test_setup.py run --cargo-enabled cargo run --scale 3
```

Building the global-client with a watcher:

```
npm run watch
```

NB There is no Hot Module Replacement, so you need to manualy refresh.

## Testing

```
npm run test
```
