<template>
    <div class="relative">
        <input class="w-full h-8 px-2 py-1 truncate rounded-lg dark:bg-transparent dark:text-white dark:border-white focus:border-black focus:outline-0 focus:outline-offset-0 focus:ring-0" type="text" v-model="value" :placeholder="$t('others.search')" :title="$t('others.search')" @keydown="changed()" @keydown.enter="submit()" @keydown.esc="cancel()" />
        <Icon class="absolute right-2 top-2 search-icon float-right" type="search" size="sm"></Icon>
    </div>
</template>

<script setup lang="ts">
    import { useFormInputEvents, usedEvents } from '@/composables/useFormInputEvents';

    const emit = defineEmits(usedEvents);
    const { value, changed, submit, cancel } = useFormInputEvents(emit);
</script>
