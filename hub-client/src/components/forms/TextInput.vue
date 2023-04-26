<template>
    <input v-tw-class="'w-full'" class="truncate rounded-lg border py-1 px-2 dark:bg-transparent dark:text-white dark:border-white focus:border-black focus:outline-0 focus:outline-offset-0 focus:ring-0" type="text" v-model="value" :placeholder="placeholder" :title="placeholder" @keyup="changed()" @keydown.enter="submit()" @keydown.esc="cancel()" />
</template>

<script setup lang="ts">
    import { useFormInputEvents, usedEvents } from '@/composables/useFormInputEvents';

    defineProps({
        placeholder: {
            type: String,
            default: '',
        },
    });

    const emit = defineEmits(usedEvents);
    const { value, changed, submit, cancel } = useFormInputEvents(emit);

</script>
