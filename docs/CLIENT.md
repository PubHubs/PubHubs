# Pubhubs Client

A [PubHubs](https://pubhubs.net/) client. In its core a matrix client with specific PubHubs needs.

Build on top of `matrix-js-sdk` with `TypeScript`, `VueJs3` and `Tailwind`.

The whole client exists of two apps:

- The Global-client, which is served from PubHubs and mainly used to switch from hub to hub.
- The Hub-client, which lives in an iFrame and will be served by the Hub. There are multiple Hubs, but only one Hub-client is loaded and visible.

# Installing

For normal use this should automatically be done with the PubHubs deployment and install procedure. See `./README.md`.

# Development

For Development and Theming see the README.md of the seperate clients `../global-client` and `../hub-client`.

Note that there are several shared resources such as theming, stores and components. Most of them will be in `../hub-client/src`.

# Technical overview

## Use of matrix-js-sdk and stores

The client is build with [TypeScript](https://www.typescriptlang.org/), [VueJS](https://vuejs.org/) for the coding and [Tailwind](https://tailwindcss.com/) for the theming.

To have a jumpstart with the [Matrix API](https://spec.matrix.org/latest/) we use the [matrix-js-sdk](https://github.com/matrix-org/matrix-js-sdk). Which give us some classes (for example for Rooms and Users) and an event system.

We extended the SDK classes into [Pinia](https://pinia.vuejs.org/) stores. See `./src/store`. These stores can be used in a page or component (for example the Rooms class and store):

```ts
import { Room, useRooms } from '@/store/store'
```

Calls to the SDK should not be given directly to the SDK but through the PubHubs wrapper `./src/pubhubs.ts`. Which can be injected in a page or component with:

```ts
const pubhubs:any = inject('pubhubs');
```

The Events fired by the SDK are captured and processed within `./src/core/events.ts`.


## Messages between global-client and hub-client

We tried to seperate the Global-client and the Hub-client as much as possible (via an iFrame). But some communication is necessary for a smooth user-experience. Such as:

- Syncing the current roomId, so the global url will reflect not only the current hub, but also the current room.
- Syncing global settings for the UI, mainly the Theme (Dark/Light/System).
- Total unread messages of the current hub. So the global client can show this number in a Badge. (and doesn't need to load this info from the sever).
- A global Dialog Component is used by the Hub-client for simple Cancel/Yes confirm dialogs so the total UI will be masked instead of only the iframe of the hub-client.

These messages are handled within the `../hub-client/src/store/messagebox.ts` (see there for more documentation).

