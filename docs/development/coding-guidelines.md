# Coding guidelines

## Why these guidelines

## Vue & TypeScript

### Imports

Imports are automatically sorted by the Prettier formatter. This will split up the imports into the order defined in the `.prettierrc`.

- Use absolute imports where possible. This makes it easier to move files without breakling the imports and it looks consistent.
- Every block of imports is annotated with the import type, ex. `//Packages`.
- If a block contains imports from both `@hub-client as` `@global-client`, an empty line is placed between.

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

### Annotation

### Props definition

We handle props definition in the following way.

- Using `withDefaults` saves 2 lines per prop compared to when using just `defineProps`.
- This alows to type props easily by doing `defineProps<Props>`.

```ts
// Props
const props = withDefaults(
  defineProps<{
    label: string;
    title: string:
    isActive: boolean;
  }>(),
  {
    isActive: false,
  }
);
```
