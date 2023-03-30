# Pubhubs Client

A [PubHubs](https://pubhubs.net/) client. In its core a matrix client with specific PubHubs needs.

Build on top of `matrix-js-sdk` with `TypeScript`, `VueJs3` and `Tailwind`.

# Installing

For normal use this should automatically be done with the PubHubs deployment and install procedure. See `./README.md`.

For Development or Theming see below.


# Setup for development or theming

[Node](https://nodejs.org) should be present on your system.

```
npm install
```

Set url of the hubs-homeserver in `public/client-config.js`:

```
"HUB_URL": "https://localhost:8008" // Default for local development together with backend servers.
```

For developing/theming on the client only, create and set `.env.local` to:

```
"HUB_URL": "https://main.testhub-matrix.ihub.ru.nl"
```

[Read more about VueCLI](https://cli.vuejs.org/guide/mode-and-env.html#environment-variables) `.env` & `.env.local`.

## Localization

We use [Vue I18n](https://vue-i18n.intlify.dev/) for localization. Language files are in `./src/locales`. Supported languages can be set in `./src/i18n.ts`.

## Theming and UI

### Starting the histoire environment

We use [histoire](https://histoire.dev) to showcase all the components and there stories.

Start the histoire environment:

```
npm run story:dev
```

And open the histoire environment with the given URL (defaults to: http://localhost:6006/).

### Change theme (colors etc)

Theming can be changed in: `./src/assets/pubhubs-theme.js`.

See [Tailwind Theming](https://tailwindcss.com/docs/theme) for how theming works. We removed the standard Tailwind colorsystem (a bit bloated) and replaced it with a more elegant and to the point system.

To reflect changes you need to restart histoire: `npm run story:dev`. This could change the URL for histoire.


### Components & Tailwind classes

Testing and viewing components can be done within the histoire environment. Changing components should be done in de components code. Changes in the code will reflect immediately in the histoire environment.

You can find the components in `./src/components`. The subfolders corresponds with the component tree in histoire.

In most components changing (tailwind) classes in the tags should be enough:

```js
class="..."
```

In some components a dynamic class is used for example in the `Button.vue` component:

```js
:class="colorClass[color]"
```

Here `colorClass` refers to this code:

```js
const colorClass : { [key:string]:string } = {
    ...
};
```

Where you can change te class per given color.

#### Overruling Tailwind classes

With components its possible to override there default tailwind classes. For example colors and sizing. But overruling these classes not always works as expected (due to the order of declaration within Tailwind). For these circumstances there is a globally present directive: `v-tw-class`.
All the tailwind classes inside this directive can be overruled by calling the component with other classes.

### Icons

Icons (svg) are all in one TypeScript object (strings) in `./src/assets/icons.ts`. You can add or change sizes and icons there. See the comments in the file.


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

## With Docker

### Building with Docker

```
docker build -f Dockerfile -t hub-client .
```

### Running with Docker

```
docker run -p 8080:8080 hub-client
```


## Testing

```
npm run test
```
