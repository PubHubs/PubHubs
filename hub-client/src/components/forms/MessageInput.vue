<template>
    <div class="flex">
        <div class="relative w-full">
            <Icon class="absolute left-3 top-2 dark:text-white" type="paperclip" @click="clickedAttachment($event)"></Icon>
            <input type="file" accept="image/png, image/jpeg, image/svg" class="attach-file" ref="file" @change="submitFile" hidden>
            <input v-focus class="px-10 py-2 w-full truncate border rounded-lg dark:bg-transparent dark:text-white dark:border-white focus:border-black focus:outline-0 focus:outline-offset-0 focus:ring-0" type="text" v-model="value" :placeholder="$t('rooms.new_message')" :title="$t('rooms.new_message')" @keydown="changed();checkButtonState()" @keydown.enter="submit()" @keydown.esc="cancel()" />
            <Icon class="absolute right-3 top-2 dark:text-white" type="emoticon" @click.stop="showEmojiPicker = !showEmojiPicker"></Icon>
        </div>

        <Button class="ml-2 flex" :disabled="!buttonEnabled" @click="submit()"><Icon type="talk" size="sm" class="mr-2 mt-1"></Icon>{{ $t('message.send') }}</Button>

        <div v-if="showEmojiPicker" class="absolute bottom-16 right-8" ref="emojiPicker">
            <EmojiPicker @emojiSelected="clickedEmoticon" />
        </div>

    </div>
</template>

<script setup lang="ts">
    import {inject, ref, onMounted, onUnmounted, nextTick} from 'vue';
    import { useFormInputEvents, usedEvents } from '@/composables/useFormInputEvents';
    import { useRooms } from '@/store/store'

    const showEmojiPicker = ref(false);
    const emojiPicker = ref<HTMLElement | null>(null); // Add this reference

    const rooms = useRooms();
    const pubhubs:any = inject('pubhubs');

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

    function clickedEmoticon(emoji:any) {
        value.value += emoji.emoji;
    }

    function clickedAttachment(event:any) {
        let parent = event.target.parentElement;
        let fileInput = parent.querySelector('.attach-file');
        if (fileInput instanceof HTMLElement) {
            fileInput.click();
        }
    }

    function submitFile(event:any) {
        const files = event.target.files;

        const fileReader = new FileReader();
        fileReader.readAsArrayBuffer(files[0]);

        const req = new XMLHttpRequest();

        fileReader.onload = (evt:any) => {
            req.open("POST", pubhubs.getBaseUrl() + '/_matrix/media/r0/upload', true );
            req.setRequestHeader('Authorization', 'Bearer ' + pubhubs.Auth._fetchAuth().accessToken);
            req.setRequestHeader("Content-Type", files[0].type);
            req.send(evt.target.result);
        };

        req.onreadystatechange = function () {
            if (req.readyState === 4) {
                if (req.status === 200) {
                    const obj = JSON.parse(req.responseText);
                    const uri =  obj.content_uri;
                    pubhubs.addImage(rooms.currentRoomId,uri);
                }
            }
        };
    }

    onMounted(() => {
        nextTick(() => {
        document.addEventListener("click", handleClickOutside);
        });
    });

    onUnmounted(() => {
        document.removeEventListener("click", handleClickOutside);
    });

    function handleClickOutside(e: MouseEvent) {
        if (
            emojiPicker.value !== null &&
            !emojiPicker.value.contains(e.target as Node)
        ) {
            showEmojiPicker.value = false;
        }
    }



</script>
