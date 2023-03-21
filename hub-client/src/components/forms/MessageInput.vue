<template>
    <div class="flex">
        <div class="relative w-full">
            <Icon class="absolute left-3 top-2 dark:text-white" type="paperclip" @click="clickedAttachment"></Icon>
            <input v-focus class="px-10 py-2 w-full truncate border rounded-lg dark:bg-transparent dark:text-white dark:border-white focus:border-black focus:outline-0 focus:outline-offset-0 focus:ring-0" type="text" v-model="value" :placeholder="$t('rooms.new_message')" :title="$t('rooms.new_message')" @keydown="changed();checkButtonState()" @keydown.enter="submit()" @keydown.esc="cancel()" />
            <Icon class="absolute right-3 top-2 dark:text-white" type="emoticon" @click="clickedEmoticon"></Icon>
        </div>
        <Button class="ml-2 flex" :disabled="!buttonEnabled" @click="submit()"><Icon type="talk" size="sm" class="mr-2 mt-1"></Icon>{{ $t('message.send') }}</Button>
    </div>
</template>

<script setup lang="ts">
    import { ref } from 'vue';
    import { useFormInputEvents, usedEvents } from '@/composables/useFormInputEvents';

    const emit = defineEmits(usedEvents);
    const { value, changed, submit, cancel } = useFormInputEvents(emit);

    const buttonEnabled = ref(false);

    function checkButtonState() {
        if (value.value!=='') {
            buttonEnabled.value = true;
        }
        else {
            buttonEnabled.value = false;
        }
    }

    // TODO
    function clickedEmoticon() {
        alert('Clicked Emotion');
    }

    // TODO
    function clickedAttachment() {
        alert('Clicked Attachment');
    }
</script>
