# Hub client

The hub client is the Matrix client for one hub, in `hub-client/`. It is built with TypeScript,
[Vue 3](https://vuejs.org), [Vite](https://vite.dev) and [Tailwind](https://tailwindcss.com), on top
of [matrix-js-sdk](https://github.com/matrix-org/matrix-js-sdk). This page shows where things are;
how to run it is in [Development](development.md#only-the-hub-client), and the conventions are in
the [coding guidelines](coding-guidelines.md).

## Matrix and the stores

matrix-js-sdk talks to the hub server and gives the client its rooms, users and events. On top of
it, the client's state is in [Pinia](https://pinia.vuejs.org) stores in `src/stores/`:

```ts
import { useRooms } from '@hub-client/stores/rooms';

const rooms = useRooms();
```

- `src/stores/pubhubs.ts` starts the Matrix client and does most of the talking to the SDK.
- `src/logic/core/events.ts` handles the events the SDK fires.
- `src/stores/messagebox.ts` talks to the global client around it, see
  [Architecture](architecture.md#global-client-and-hub-client).

The paths of the hub server's endpoints are in `src/logic/core/api.ts`, and the calls in
`src/logic/core/apiService.ts`; the endpoints themselves are described in [Hub API](hub-api.md).

## Styling

Components are in `src/components/`, the basic ones in `src/components/elements/`, and are styled
with Tailwind classes in their templates. Where a component has variants, such as the colours of a
button, the classes for each are in its script.

A component's default classes can't always be overridden from outside, because of the order Tailwind
declares them in. Put such defaults in the `v-tw-class` directive instead: classes given to the
component then win.

## Icons

Icons are SVG strings in `src/assets/icons.ts`, from [Phosphor](https://phosphoricons.com), with
their sizes. The comment at the top says how to add one. `src/assets/icons_overview.md` maps the
names to Phosphor's.

## Languages

Text is translated with [Vue I18n](https://vue-i18n.intlify.dev). The strings are in `src/locales/`
(`en.ts`, `nl.ts`), and the supported languages are set in `src/i18n.ts`.

## Tests

The tests are in `hub-client/test/`, with [Vitest](https://vitest.dev):

```sh
npm run test:run   # once
npm run test       # on every change
```
