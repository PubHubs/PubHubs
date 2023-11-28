<template>
	<div class="flex items-end">
		<!-- Textinput -->
		<div class="w-4/5 bg-gray-lighter dark:bg-gray rounded-xl">
			<!-- Reply -->
			<div class="h-10 w-full flex items-center" v-if="messageActions.replyingTo">
				<p class="ml-4 whitespace-nowrap mr-2">{{ $t('message.in_reply_to') }}</p>
				<MessageSnippet class="w-[85%]" :event="messageActions.replyingTo "></MessageSnippet>
				<button class="mr-4 ml-auto" @click="delete messageActions.replyingTo">
					<Icon type="closingCross" size="sm"></Icon>
				</button>
			</div>

			<div v-if="signingMessage" class="absolute bottom-[400px] left-60" id="yivi-web-form">

			</div>

			<div class="relative">
				<Icon class="absolute left-3 top-2 dark:text-white" type="paperclip" @click="showUploadPicker" :asButton="true"></Icon>
				<Popover :outside-node="getDocument()" :ignore-click-outside="'openingUploadPicker'" v-if="showingUploadPicker" ref="elPopover" @close="showingUploadPicker = false" class="absolute bottom-14">
					<UploadPicker @attachment="clickedAttachment" @sign="showSigningMessageMenu()" ></UploadPicker>
				</Popover>
				<input type="file" :accept="getTypesAsString(allTypes)" class="attach-file" ref="elFileInput" @change="uploadFile($event)" hidden />
				<TextArea
					class="px-10 -mb-1"
					v-focus
					:placeholder="$t('rooms.new_message')"
					:title="$t('rooms.new_message')"
					v-model="value"
					@changed="
						changed();
						checkButtonState();
					"
					@submit="submitMessage()"
					@cancel="cancel()"
					@keydown.enter.prevent="submitMessage"
				></TextArea>
				<Icon class="absolute right-3 top-2 dark:text-white" type="emoticon" @click.stop="showEmojiPicker = !showEmojiPicker" :asButton="true"></Icon>
			</div>

			<!-- Sign message -->
			<div v-if="signingMessage" class="bg-gray-light dark:bg-gray-darker flex items-center rounded-md p-2">
				<Icon type="sign" size="base" class="ml-2 mr-2 self-start mt-1"></Icon>
				<div class="ml-2 flex flex-col justify-between max-w-3xl">
					<h3 class="font-bold">{{ $t('message.sign.heading') }}</h3>
					<p>{{ $t('message.sign.info') }}</p>
					<div name="warning" class="flex items-center mt-2">
						<Icon type="warning" size="sm" class="mb-[2px] mr-2 self-start mt-1"></Icon>
						<p class="italic">{{ $t('message.sign.warning') }}</p>
					</div>
					<Line class="mb-2"></Line>
					<p>{{ $t('message.sign.selected_attributes') }}</p>
					<div class="bg-black rounded-full w-20 flex justify-center mt-1 text-white">
						<p>Email</p>
					</div>
				</div>
				<Icon type="closingCross" size="sm" :asButton="true" @click="signingMessage=false" class="ml-auto self-start"></Icon>
			</div>
		</div>

		<!-- Emojipicker -->
		<div v-if="showEmojiPicker" class="absolute bottom-16 right-8" ref="elEmojiPicker">
			<EmojiPicker @emojiSelected="clickedEmoticon" />
		</div>

		<!-- Sendbutton -->
		<Button class="h-10 ml-2 mr-2 flex items-center" :disabled="!buttonEnabled" @click="submitMessage()"><Icon type="talk" size="sm" class="mr-px mb-1"></Icon>{{ $t(sendMessageText) }}</Button>
	</div>
</template>

<script setup lang="ts">
	import { watch, ref, onMounted, onUnmounted, nextTick, computed } from 'vue';
	import { useFormInputEvents, usedEvents } from '@/composables/useFormInputEvents';
	import { useMatrixFiles } from '@/composables/useMatrixFiles';
	import { useDialog, useRooms } from '@/store/store';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { useRoute } from 'vue-router';
	import { useMessageActions } from '@/store/message-actions';

	import { photoUpload } from '@/composables/photoUpload';
	import UploadPicker from '../ui/UploadPicker.vue';
	import Popover, { CurrentlyOpeningEvent } from '../ui/Popover.vue';

	import { YiviSigningSessionResult } from '@/lib/signedMessages';
	import { fileUpload as uploadHandler } from '@/composables/fileUpload';

	const route = useRoute();
	const rooms = useRooms();
	const pubhubs = usePubHubs();
	const messageActions = useMessageActions();
	const emit = defineEmits(usedEvents);
	const { value, reset, changed, cancel } = useFormInputEvents(emit);
	const { allTypes, getTypesAsString, uploadUrl, imageTypes } = useMatrixFiles(pubhubs);

	const elPopover = ref<InstanceType<typeof Popover> | null>(null);
	const buttonEnabled = ref(false);
	const showingUploadPicker = ref(false);
	const signingMessage = ref(false);
	const showEmojiPicker = ref(false);

	const selectedAttributesSigningMessage = ref<string[]>(['irma-demo.sidn-pbdf.email.domain']);

	const elEmojiPicker = ref<HTMLElement | null>(null); // Add this reference
	const elFileInput = ref<HTMLInputElement | null>(null);

	const sendMessageText = computed(() => {
		if (signingMessage.value) {
			return 'message.sign.send';
		}
		return 'message.send';
	})

	watch(route, () => {
		reset();
	});

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

	function uploadFile(event: Event) {
		const accessToken = pubhubs.Auth.getAccessToken();
		const target = event.currentTarget as HTMLInputElement;
		const dialog = useDialog();
		uploadHandler(accessToken, uploadUrl, allTypes, event, (uri) => {
			if (target) {
				const file = target.files && target.files[0];
				if (file) {
					dialog.yesno(`Do you want to upload the attachment: ${file.name}?`).then((done) => {
						if (done) {
							if (imageTypes.includes(file.type)) {
								pubhubs.addImage(rooms.currentRoomId, uri);
							} else {
								pubhubs.addFile(rooms.currentRoomId, file, uri);
							}
						}
					});
				}
			}
			reset();
		});
	}

	function clickedAttachment() {
		elFileInput.value?.click();
	}

	function submitMessage() {
		if (!value.value || !(typeof value.value == 'string')) return;

		if (signingMessage.value) {
			signMessage(value.value, selectedAttributesSigningMessage.value)
		} else if (messageActions.replyingTo) {
			pubhubs.addMessage(rooms.currentRoomId, value.value, messageActions.replyingTo);
			messageActions.replyingTo = undefined;
		} else {
			pubhubs.addMessage(rooms.currentRoomId, value.value);
		}

		value.value = '';
	}

	function signMessage(message: string, attributes: string[]) {
		rooms.yiviSignMessage(message, attributes, rooms.currentRoomId, pubhubs.Auth.getAccessToken(), finishedSigningMessage);
	}

	function finishedSigningMessage(result: YiviSigningSessionResult) {
		pubhubs.addSignedMessage(rooms.currentRoomId, result);
		signingMessage.value = false;
	}

	onMounted(() => {
		nextTick(() => {
			document.addEventListener('click', handleClickOutside);
		});
		reset();
	});

	onUnmounted(() => {
		document.removeEventListener('click', handleClickOutside);
	});


	function showUploadPicker(event: MouseEvent) {
		// Close the 'replying to' UI
		messageActions.replyingTo = undefined;
		// This custom property is used in the Popover component.
		// It prevents the upload picker from closing immediately by the click that opened it.
		(event as CurrentlyOpeningEvent).openingUploadPicker = true;

		showingUploadPicker.value = true;
	}

	function showSigningMessageMenu() {
		showingUploadPicker.value = false;
		signingMessage.value = true;
	}

	function handleClickOutside(e: MouseEvent) {
		if (elEmojiPicker.value !== null && !elEmojiPicker.value.contains(e.target as Node)) {
			showEmojiPicker.value = false;
		}
	}

	function getDocument() {
		return document;
	}
</script>
@/composables/fileUpload
