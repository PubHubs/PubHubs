# Pubhubs Global Client

The global [PubHubs](https://pubhubs.net/) client.

Build with `TypeScript`, `VueJs3` and `Tailwind`.

# Installing

For normal use this should automatically be done with the PubHubs deployment and install procedure. See `./README.md`.

For Development or Theming see below.


# Setup for development or theming

[Node](https://nodejs.org) should be present on your system.

```
npm install
```

## Localization &&

We use [Vue I18n](https://vue-i18n.intlify.dev/) for localization. Language files are in `../hub-client/src/locales`. Supported languages can be set in `./src/i18n.ts`.

## Theming and UI

Theming importerd from hub-client in: `../hub-client/src/assets/pubhubs-theme.js`.

## Development

First setup a development environment (see above). Then start the development server and open the given URL in the browser. This has Hot Module Replacement for fast UI development:

```
npm run serve
```

## Production

Should be done automatically with deployment. But can be tested locally.

```
npm run build
```

As a PWA:

```
npm run pwa
```


## Testing

```
npm run test
```

# Technical overview

The client is build with [TypeScript](https://www.typescriptlang.org/), [VueJS](https://vuejs.org/) for the coding and [Tailwind](https://tailwindcss.com/) for the theming.
