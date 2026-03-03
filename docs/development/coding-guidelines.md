## Coding guidelines

---

### Annotation

We use [JSDoc](https://jsdoc.app) annotations to describe the purpose of parameters and return values. Since TypeScript already provides the types, omit type information from the JSDoc.'

VSCode has built-in functionality to generate JSDoc documentation, which you can activate by typing `/**` above a function. Because we are using TypeScript, you can refrain from using types in the JSDoc annotation.

```ts
/**
 * Paginate in a given {direction} for a {limit} number of events
 *
 * @param backwards - Whether to paginate forwards (newer events) or backwards (older events)
 * @param timeline - What timeline to use for the pagination
 * @param limit - How many events to fetch
 * @returns - An array of events to be added to the timeline
 */
const performPaginate = (
  direction: Direction,
  limit: number,
  timeline: EventTimeline
): Promise<MatrixEvent[]> => {
  // Function
};
```

For in-code annotation, we use single-line comments (`//`) to:

- Explain why, not what. Only add a comment when the code alone doesn't make the intent clear.
- Label logical steps within longer functions to make them easier to scan.
- Document non-obvious choices.

```ts
const setLastReadMessage = (
  roomId: string,
  eventId: string,
  timestamp: number
): void => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const messages = stored ? JSON.parse(stored) : {};
    const existingData = messages[roomId];

    // Only update if this message is newer than the existing one
    if (
      existingData &&
      typeof existingData === "object" &&
      existingData.timestamp >= timestamp
    ) {
      return;
    }

    messages[roomId] = { eventId, timestamp };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // Silently fail since the localStorage might be unavailable
  }
};
```

---

### Order of aspects

We order the aspects in all `*.ts` and `*.vue` files as following:

1. Imports
2. Types
3. Props
4. Constants/vars
5. Computed props?
6. Refs
7. Lifecycle
8. Watchers
9. Functions
10. Exports

> Question: Should we use region markers to divide these?

---

### Imports

Imports are automatically sorted by the [Prettier](https://prettier.io) formatter. This will split up the imports into the order defined in the `.prettierrc`.

- _Use absolute imports_ where possible. This makes it easier to move files without breaking the imports and it looks consistent.
- Every block of imports is annotated with the import type, ex. `// Packages`.
- If a block contains imports from both `@hub-client` and `@global-client`, an empty line is placed between.

```ts
// Packages
import { computed, onMounted, ref, watch } from "vue";

// Components
import Badge from "@hub-client/components/elements/Badge.vue";
import H3 from "@hub-client/components/elements/H3.vue";

// Stores
import { useGlobal } from "@global-client/stores/global";

import { useDialog } from "@hub-client/stores/dialog";
```

---

### Props definition

We handle props definition in the following way.

- Using `withDefaults` separates type definitions from default values cleanly, and saves lines.
- A prop is required when no default is given, and it i not marked as optional.
- Props are sorted alphabetically.

```ts
// Props
const props = withDefaults(
  defineProps<{
    isActive: boolean;
    label: string;
    title: string;
  }>(),
  {
    isActive: false,
  }
);
```

---

### Functions

We use [arrow functions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions) (`=>`) as the default way to define functions, where this is possible. Arrow functions are preferred because they provide a shorter, more readable syntax.

```ts
// Preferred
const fetchMessages = (roomId: string, limit: number): Promise<Message[]> => {
  // Function
};
```

```ts
// Avoid
function fetchMessages(roomId: string, limit: number): Promise<Message[]> {
  // Function
}
```

For short, single-expression functions, use the implicit return:

```ts
const isActive = (room: Room): boolean => room.state === "active";
```

---

### Exporting

For clarity, instead of exporting functions or variables in-line, we export them in a single block at the end of the file where possible. Note that some files, such as composables or Pinia stores will still rely on `export default`.

```ts
const myConst = "Hi";

const myFunction = () => {
  // Function
};

// Rest of the file

export { myConst, myFunction };
```

---

### Error handling

...

---

### Pinia stores

Stores are responsible for holding reactive state and exposing it to components. We follow a clear separation between stores and composables.

#### What belongs in the store

- State: Raw reactive data.
- Getters: Only for derived/computed values. Do not create getters that simply return state, as Pinia already exposes state reactively.
- Actions: Thin state mutations (setters). No API calls, no orchestration, no routing.

#### What belongs in the composable

- API calls combined with state updates
- Orchestration logic (e.g., fetch data, then update store, then navigate)
- Reading from external sources (e.g., Matrix SDK) using store state

#### Getters

- Use `this.` to access state inside getters, not destructured parameters.
- Only create a getter when it adds logic. Accessing `userStore.userId` directly is preferred over a pass-through getter, since a getter with the same name as a state property causes infinite recursion in Pinia (see issue [#1331](https://github.com/vuejs/pinia/issues/1331)).
- Name boolean getters as questions: `isLoggedIn`, `isAdmin`, `hasConsented`.

```ts
// Good(derived value)
isLoggedIn(): boolean {
  return typeof this.userId === 'string';
},

// Good (transformation)
pseudonym(): string {
  assert.isDefined(this.userId, 'Missing userId');

  return filters.extractPseudonym(this.userId!);
},

// Avoid (pass-through, just access state directly)
userId(): string | undefined {
  return this.userId; // Infinite recursion!
},
```

#### Actions

- Keep actions as thin state mutations. Move logic to composables.
- Actions that accept arguments and set state are fine.

```ts
// Good (thin setter)
setUserId(userId: string) {
  this.userId = userId;
},

// Avoid (API call + state mutation in the store)
async fetchIsAdmin(client: MatrixClient) {
  const isAdmin = await client.isSynapseAdministrator();
  this.isAdministrator = isAdmin;
},
```

#### State grouping

Group related state properties with comments, and keep the same order in both the type definition and the initial state:

```ts
type State = {
  // Identity
  userId: string | undefined;
  // Profile
  displayName: string | undefined;
  avatarUrl: string | undefined;
  // Roles
  isAdministrator: boolean;
};
```

---

### Typing

We avoid interfaces!
