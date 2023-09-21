<template>
	<div class="flex items-end">
		<div class="w-4/5 bg-gray-lighter dark:bg-gray rounded-xl">
			<div class="h-11 w-full flex items-center" v-if="messageActions.replyingTo">
				<p class="ml-4 whitespace-nowrap mr-2">{{ $t('message.in_reply_to') }}</p>
				<MessageSnippet class="w-[85%]" :event="messageActions.replyingTo"></MessageSnippet>
				<button class="mr-4 ml-auto" @click="delete messageActions.replyingTo">
					<Icon type="closingCross" size="sm"></Icon>
				</button>
			</div>

			<div class="h-11 flex">
				<button><Icon class="my-auto ml-3" type="paperclip" @click="clickedAttachment($event)"></Icon></button>
				<input type="file" accept="image/png, image/jpeg, image/svg" class="attach-file" ref="file" @change="submitFile($event)" hidden />
				<Line class="ml-3 mr-1 h-3/5 my-auto" :direction="'Vertical'" :thickness="'[1.5px]'"></Line>
				<input
					ref="inputElement"
					v-focus
					class="w-full truncate border-none bg-transparent focus:ring-0"
					type="text"
					v-model="value"
					:placeholder="$t('rooms.new_message')"
					:title="$t('rooms.new_message')"
					@keydown="changed()"
					@keydown.enter="submit()"
					@keydown.esc="cancel()"
					@keyup="checkButtonState()"
				/>
				<button class="my-auto mr-3">
					<Icon type="emoticon" @click.stop="showEmojiPicker = !showEmojiPicker"></Icon>
				</button>
				<div v-if="showEmojiPicker" class="absolute bottom-16 right-8" ref="emojiPicker">
					<EmojiPicker @emojiSelected="clickedEmoticon" />
				</div>
			</div>
		</div>

		<Button class="h-11 ml-2 mr-2 flex items-center" :disabled="!buttonEnabled" @click="submit()"><Icon type="talk" size="sm" class="mr-px mb-1"></Icon>{{ $t('message.send') }}</Button>
	</div>
</template>

<script setup lang="ts">
	import { ref, onMounted, onUnmounted, nextTick} from 'vue';
	import { useFormInputEvents, usedEvents } from '@/composables/useFormInputEvents';
	import { useRooms } from '@/store/store';
	import { usePubHubs } from '@/core/pubhubsStore';
	import MessageSnippet from '../rooms/MessageSnippet.vue';
	import { useMessageActions } from '@/store/message-actions';

	const rooms = useRooms();
	const pubhubs = usePubHubs();
	const messageActions = useMessageActions();
	const emit = defineEmits(usedEvents);
	const { value, changed, cancel } = useFormInputEvents(emit);

	const buttonEnabled = ref(false);
	const showEmojiPicker = ref(false);
	const emojiPicker = ref<HTMLElement | null>(null); // Add this reference

	// Focus on message input if the state of messageActions changes (for example, when replying).
	const inputElement = ref<HTMLInputElement>();
	messageActions.$subscribe(() => {
		inputElement.value?.focus();
	});

	function checkButtonState() {
		buttonEnabled.value = false;
		if (value.value !== undefined) {
			if (typeof value.value == 'number') {
				buttonEnabled.value = true;
			}
			if (typeof value.value == 'string' && value.value.length > 0) {
				buttonEnabled.value = true;
			}
		}
	}

	function clickedEmoticon(emoji: string) {
		value.value += emoji;
		checkButtonState();
	}

	function clickedAttachment(event: UIEvent) {
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

	function submitFile(event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		if (target) {
			const files = target.files;
			if (files) {
				const fileReader = new FileReader();
				fileReader.readAsArrayBuffer(files[0]);

				const req = new XMLHttpRequest();
				fileReader.onload = () => {
					req.open('POST', pubhubs.getBaseUrl + '/_matrix/media/r0/upload', true);
					req.setRequestHeader('Authorization', 'Bearer ' + pubhubs.Auth.getAccessToken());
					req.setRequestHeader('Content-Type', files[0].type);
					req.send(fileReader.result);
				};

				req.onreadystatechange = function () {
					if (req.readyState === 4) {
						if (req.status === 200) {
							const obj = JSON.parse(req.responseText);
							const uri = obj.content_uri;
							pubhubs.addImage(rooms.currentRoomId, uri);
						}
					}
				};
			}
		}
	}

	function submit() {
		if (!value.value || !(typeof value.value == 'string')) return;

		if (messageActions.replyingTo) {
			pubhubs.addMessage(rooms.currentRoomId, value.value, messageActions.replyingTo);
			messageActions.replyingTo = undefined;
		} else {
			pubhubs.addMessage(rooms.currentRoomId, value.value);
		}

		value.value = '';
	}

	onMounted(() => {
		nextTick(() => {
			document.addEventListener('click', handleClickOutside);
		});
	});

	onUnmounted(() => {
		document.removeEventListener('click', handleClickOutside);
	});

	function handleClickOutside(e: MouseEvent) {
		if (emojiPicker.value !== null && !emojiPicker.value.contains(e.target as Node)) {
			showEmojiPicker.value = false;
		}
	}
</script>
