# Running a local development setup for developing the HubClient

In most cases (external) developers only need to develop for the hub's client.
For this a complete total local development environment is overkill [see](./LOCAL_DEVELOPMENT.md).

For a simple local development on a hub-client we need to have a running hub server. If that's not the case, or not an option, then a complete local development environment is still needed [see](./LOCAL_DEVELOPMENT.md).

## Technical insights of the Hub Client

A [PubHubs](https://pubhubs.net/) client. In its core a matrix client with specific PubHubs needs.

Built on top of `matrix-js-sdk` with `TypeScript`, `Vue 3`, `Vite` and `Tailwind`.

## First development setup

[Node](https://nodejs.org) version 22.0.0 or higher should be present on your system.

From the repository root, run:

```
npm install
```

## Developing

### Against local hub server

First ensure the local development environment is running (see [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md)), then start the hub client:

```bash
mask run hub client 0    # Runs hub client for testhub0 on port 8001
```

### Against staging server

For development without running a local backend:

```bash
mask run hub mainclient       # Hub client against staging server
mask run hub mainclient enter # Get login URL with access token
```

### Manual development server

From the `hub-client` folder:

```
npm run serve
```

This starts a Vite development server with Hot Module Replacement.

## Theming and UI

### Components & Tailwind classes

You can find the components in `./src/components`.

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

Where you can change the class per given color.

#### Overruling Tailwind classes

With components its possible to override their default tailwind classes. For example colors and sizing. But overruling these classes not always works as expected (due to the order of declaration within Tailwind). For these circumstances there is a globally present directive: `v-tw-class`.
All the tailwind classes inside this directive can be overruled by calling the component with other classes.

### Icons

Icons (svg) are all in one TypeScript object (strings) in `./src/assets/icons.ts`. You can add or change sizes and icons there. See the comments in the file.

## Localization

We use [Vue I18n](https://vue-i18n.intlify.dev/) for localization. Language files are in `./src/locales`. Supported languages can be set in `./src/i18n.ts`.

## Use of matrix-js-sdk and stores

The client is built with [TypeScript](https://www.typescriptlang.org/), [Vue 3](https://vuejs.org/) for the coding and [Tailwind](https://tailwindcss.com/) for the theming.

To have a jumpstart with the [Matrix API](https://spec.matrix.org/latest/) we use the [matrix-js-sdk](https://github.com/matrix-org/matrix-js-sdk). Which gives us some classes (for example for Rooms and Users) and an event system.

We use [Pinia](https://pinia.vuejs.org/) stores in `./src/stores`. These stores can be used in a page or component:

```ts
import { useRooms } from '@hub-client/stores/rooms';

const rooms = useRooms();
```

The main PubHubs store is in `./src/stores/pubhubs.ts`. This handles Matrix client initialization and SDK interactions.

The Events fired by the SDK are captured and processed within `./src/logic/core/events.ts`.

## Messages between global-client and hub-client

We tried to separate the Global-client and the Hub-client as much as possible (via an iFrame). But some communication is necessary for a smooth user-experience. Such as:

- Syncing the current roomId, so the global url will reflect not only the current hub, but also the current room.
- Syncing global settings for the UI, mainly the Theme (Dark/Light/System).
- Total unread messages of the current hub. So the global client can show this number in a Badge. (and doesn't need to load this info from the server).
- A global Dialog Component is used by the Hub-client for simple Cancel/Yes confirm dialogs so the total UI will be masked instead of only the iframe of the hub-client.

These messages are handled within the `./src/stores/messagebox.ts` (see there for more documentation).

## Testing

```
npm run test:run    # Run tests once
npm run test        # Watch mode
```
