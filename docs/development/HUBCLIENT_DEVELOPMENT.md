# Running a local development setup for developing the HubClient

In most cases (external) developers only need to develop for the hub's client.
For this a complete total local development environment is overkill [see](./LOCAL_DEVELOPMENT.md).

For a simple local development on a hub-client we need to have a running hub server. If that's not the case, or not an option, then a complete local development environment is still needed [see](./LOCAL_DEVELOPMENT.md).

## Techical insights of the Hub Client

A [PubHubs](https://pubhubs.net/) client. In its core a matrix client with specific PubHubs needs.

Build on top of `matrix-js-sdk` with `TypeScript`, `VueJs3` and `Tailwind`.

## First development setup

[Node](https://nodejs.org) should be present on your system.

Goto the `hub-client` folder and run:

```
npm install
```

Set url of the hubs-homeserver in `public/client-config.js` or `public/client-config.local.js`:

```
"HUB_URL": "### YOUR HUB URL ###"
```

or for `client-config.local.js`:

```
_env.HUB_URL = "### YOUR HUB URL ###";
```

[Read more about VueCLI](https://cli.vuejs.org/guide/mode-and-env.html#environment-variables) `.env` & `.env.local`.


## Developing

Start developing by running:

```
npm run serve
```

### Theming and UI

#### Components & Tailwind classes

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

##### Overruling Tailwind classes

With components its possible to override there default tailwind classes. For example colors and sizing. But overruling these classes not always works as expected (due to the order of declaration within Tailwind). For these circumstances there is a globally present directive: `v-tw-class`.
All the tailwind classes inside this directive can be overruled by calling the component with other classes.

#### Icons

Icons (svg) are all in one TypeScript object (strings) in `./src/assets/icons.ts`. You can add or change sizes and icons there. See the comments in the file.

### Localization

We use [Vue I18n](https://vue-i18n.intlify.dev/) for localization. Language files are in `./src/locales`. Supported languages can be set in `./src/i18n.ts`.

### Use of matrix-js-sdk and stores

The client is build with [TypeScript](https://www.typescriptlang.org/), [VueJS](https://vuejs.org/) for the coding and [Tailwind](https://tailwindcss.com/) for the theming.

To have a jumpstart with the [Matrix API](https://spec.matrix.org/latest/) we use the [matrix-js-sdk](https://github.com/matrix-org/matrix-js-sdk). Which give us some classes (for example for Rooms and Users) and an event system.

We extended the SDK classes into [Pinia](https://pinia.vuejs.org/) stores. See `./src/store`. These stores can be used in a page or component (for example the Rooms class and store):

```ts
import { Room, useRooms } from '@hub-client/stores/rooms'
```

Calls to the SDK should not be given directly to the SDK but through the PubHubs wrapper `./src/pubhubs.ts`. Which can be injected in a page or component with:

```ts
const pubhubs:any = inject('pubhubs');
```

The Events fired by the SDK are captured and processed within `./src/core/events.ts`.


### Messages between global-client and hub-client

We tried to seperate the Global-client and the Hub-client as much as possible (via an iFrame). But some communication is necessary for a smooth user-experience. Such as:

- Syncing the current roomId, so the global url will reflect not only the current hub, but also the current room.
- Syncing global settings for the UI, mainly the Theme (Dark/Light/System).
- Total unread messages of the current hub. So the global client can show this number in a Badge. (and doesn't need to load this info from the sever).
- A global Dialog Component is used by the Hub-client for simple Cancel/Yes confirm dialogs so the total UI will be masked instead of only the iframe of the hub-client.

These messages are handled within the `../hub-client/src/store/messagebox.ts` (see there for more documentation).


## Testing

```
npm run test
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
