<template>
    <div class="flex">
        <div class="relative w-full">
            <Icon class="absolute left-3 top-2" type="paperclip" @click="clickedAttachment"></Icon>
            <input v-focus class="px-10 w-full truncate rounded-lg dark:bg-transparent dark:text-white dark:border-white focus:border-black focus:outline-0 focus:outline-offset-0 focus:ring-0" type="text" v-model="value" :placeholder="$t('rooms.new_message')" :title="$t('rooms.new_message')" @keydown="changed()" @keydown.enter="submit()" @keydown.esc="cancel()" />
            <Icon class="absolute right-3 top-2" type="emoticon" @click="clickedEmoticon"></Icon>
        </div>
        <Button class="ml-2 flex" @click="submit()"><Icon type="talk" size="sm" class="mr-2 mt-1"></Icon>{{ $t('message.send') }}</Button>
    </div>
</template>

<script setup lang="ts">
    import { useFormInputEvents, usedEvents } from '@/composables/useFormInputEvents';

    const emit = defineEmits(usedEvents);
    const { value, changed, submit, cancel } = useFormInputEvents(emit);

    function clickedEmoticon() {
        alert('Clicked Emotion');
    }

    function clickedAttachment() {
        alert('Clicked Attachment');
    }
</script>
