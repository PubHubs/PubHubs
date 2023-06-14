<template>
    <div class="flex">
        <div class="relative w-full">
            <Icon class="absolute left-3 top-2 dark:text-white" type="paperclip" @click="clickedAttachment($event)"></Icon>
            <input type="file" accept="image/png, image/jpeg, image/svg" class="attach-file" ref="file" @change="submitFile($event)" hidden>
            <input v-focus class="px-10 py-2 w-full truncate border rounded-lg dark:bg-transparent dark:text-white dark:border-white focus:border-black focus:outline-0 focus:outline-offset-0 focus:ring-0" type="text" v-model="value" :placeholder="$t('rooms.new_message')" :title="$t('rooms.new_message')" @keydown="changed()" @keydown.enter="submit()" @keydown.esc="cancel()" @keyup="checkButtonState()" />
            <Icon class="absolute right-3 top-2 dark:text-white" type="emoticon" @click.stop="showEmojiPicker = !showEmojiPicker"></Icon>
        </div>

        <Button class="ml-2 flex" :disabled="!buttonEnabled" @click="submit()"><Icon type="talk" size="sm" class="mr-2 mt-1"></Icon>{{ $t('message.send') }}</Button>

        <div v-if="showEmojiPicker" class="absolute bottom-16 right-8" ref="emojiPicker">
            <EmojiPicker @emojiSelected="clickedEmoticon" />
        </div>

    </div>
</template>

<script setup lang="ts">
    import { ref, onMounted, onUnmounted, nextTick} from 'vue';
    import { useFormInputEvents, usedEvents } from '@/composables/useFormInputEvents';
    import { useRooms } from '@/store/store'
    import { usePubHubs } from '@/core/pubhubsStore';

    const rooms = useRooms();
    const pubhubs = usePubHubs();
    const emit = defineEmits(usedEvents);
    const { value, changed, submit, cancel } = useFormInputEvents(emit);

    const buttonEnabled = ref(false);
    const showEmojiPicker = ref(false);
    const emojiPicker = ref<HTMLElement | null>(null); // Add this reference

    function checkButtonState() {
        buttonEnabled.value = false;
        if (value.value!==undefined) {
            if ( typeof(value.value)=="number" ) {
                buttonEnabled.value = true;
            }
            if ( typeof(value.value)=="string" && value.value.length > 0) {
                buttonEnabled.value = true;
            }
        }
    }

    function clickedEmoticon(emoji:string) {
        value.value += emoji;
        checkButtonState();
    }

    function clickedAttachment(event:UIEvent) {
        const target = event.currentTarget as HTMLElement;
        if (target) {
            const parent = target.parentElement;
            if (parent) {
                const fileInput = parent.querySelector('.attach-file');
                if (fileInput instanceof HTMLElement) {
                    fileInput.click();
                }
            }
        }
    }

    function submitFile(event:Event) {
        const target = event.currentTarget as HTMLInputElement;
        if (target) {
            const files = target.files;
            if (files) {
                const fileReader = new FileReader();
                fileReader.readAsArrayBuffer(files[0]);

                const req = new XMLHttpRequest();
                fileReader.onload = () => {
                    req.open("POST", pubhubs.getBaseUrl + '/_matrix/media/r0/upload', true );
                    req.setRequestHeader('Authorization', 'Bearer ' + pubhubs.Auth.getAccessToken() );
                    req.setRequestHeader("Content-Type", files[0].type);
                    req.send(fileReader.result);
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
        }
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
