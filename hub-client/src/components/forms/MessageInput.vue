<template>
	<div class="flex gap-2 items-end px-6">
		<div name="input-container" class="min-w-3/4 w-full relative rounded-xl bg-hub-background-4 dark:bg-hub-background-4">
			<!-- Floating -->
			<div class="">
				<Popover v-if="showPopover" @close="togglePopover" class="absolute bottom-[105%]">
					<UploadPicker @click="clickedAttachment"></UploadPicker>
					<SignedMessageButton @click="showSigningMessageMenu()"></SignedMessageButton>
				</Popover>
				<Mention :msg="value" :top="caretPos.top" :left="caretPos.left" @click="mentionUser($event)"></Mention>
				<div v-if="showEmojiPicker" class="absolute bottom-[105%] right-0 z-20">
					<EmojiPicker @emojiSelected="clickedEmoticon" @close="showEmojiPicker = false" />
				</div>
			</div>

			<div name="reply-to" class="h-10 w-full flex items-center" v-if="messageActions.replyingTo">
				<p class="ml-4 whitespace-nowrap mr-2">{{ $t('message.in_reply_to') }}</p>
				<MessageSnippet class="w-[85%]" :event="messageActions.replyingTo"></MessageSnippet>
				<button class="mr-4 ml-auto" @click="delete messageActions.replyingTo">
					<Icon type="closingCross" size="sm"></Icon>
				</button>
			</div>

			<div name="input-bar" class="flex items-start min-h-[50px] px-2 py-1 gap-x-2 rounded-2xl dark:bg-hub-background-4">
				<Icon class="dark:text-white self-end mb-2 pr-3 border-r-2 border-r-gray-light" type="paperclip" @click.stop="togglePopover" :asButton="true"></Icon>
				<!-- Overflow-x-hidden prevents firefox from adding an extra row to the textarea for a possible scrollbar -->
				<TextArea
					ref="elTextInput"
					class="max-h-[300px] overflow-x-hidden border-none self-end bg-transparent placeholder:text-gray-dark dark:placeholder:text-gray-lighter"
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
					@caretPos="setCaretPos"
				></TextArea>
				<Icon class="dark:text-white mb-2 self-end" type="emoticon" @click.stop="showEmojiPicker = !showEmojiPicker" :asButton="true"></Icon>
			</div>

			<div name="sign-message" v-if="signingMessage" class="m-2 bg-gray-light dark:bg-hub-background flex items-center rounded-md p-2">
				<Icon type="sign" size="base" class="ml-2 mr-2 self-start mt-1 shrink-0"></Icon>
				<div class="ml-2 flex flex-col justify-between max-w-3xl">
					<h3 class="font-bold">{{ $t('message.sign.heading') }}</h3>
					<p>{{ $t('message.sign.info') }}</p>
					<div name="warning" class="flex items-center mt-2">
						<Icon type="warning" size="sm" class="mb-[2px] mr-2 self-start mt-1 shrink-0"></Icon>
						<p class="italic">{{ $t('message.sign.warning') }}</p>
					</div>
					<Line class="mb-2"></Line>
					<p>{{ $t('message.sign.selected_attributes') }}</p>
					<div class="bg-black rounded-full w-20 flex justify-center mt-1 text-white">
						<p>Email</p>
					</div>
				</div>
				<Icon type="closingCross" size="sm" :asButton="true" @click="signingMessage = false" class="ml-auto self-start"></Icon>
			</div>
		</div>

		<!-- Sendbutton -->
		<Button class="min-h-[50px] flex rounded-xl" :disabled="!buttonEnabled" @click="submitMessage()">
			<div class="flex gap-2 text-xl items-center">
				<Icon type="talk" size="sm" class="-scale-100 rotate-45 shrink-0"></Icon>
				<span class="hidden md:flex">{{ $t(sendMessageText) }}</span>
			</div>
		</Button>

		<!-- Yivi signing qr popup -->
		<div v-if="signingMessage" class="absolute bottom-[10%] md:left-[40%]" id="yivi-web-form"></div>

		<div class="text-black dark:bg-gray-dark dark:text-white">
			<FileUpload :file="fileInfo" :mxcPath="uri" v-if="fileUploadDialog" @close="closeMenus()"></FileUpload>
			<!-- todo: move this into UploadPicker? -->
			<input type="file" :accept="getTypesAsString(allTypes)" class="attach-file" ref="elFileInput" @change="uploadFile($event)" hidden />
		</div>
	</div>
</template>

<script setup lang="ts">
	import { watch, ref, onMounted, computed } from 'vue';
	import { useFormInputEvents, usedEvents } from '@/composables/useFormInputEvents';
	import { useMatrixFiles } from '@/composables/useMatrixFiles';
	import { useRooms } from '@/store/store';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { useRoute } from 'vue-router';
	import { useMessageActions } from '@/store/message-actions';

	import { YiviSigningSessionResult } from '@/lib/signedMessages';
	import { fileUpload as uploadHandler } from '@/composables/fileUpload';

	const route = useRoute();
	const rooms = useRooms();
	const pubhubs = usePubHubs();
	const messageActions = useMessageActions();

	const emit = defineEmits(usedEvents);
	const { value, reset, changed, cancel } = useFormInputEvents(emit);
	const { allTypes, getTypesAsString, uploadUrl } = useMatrixFiles();

	const buttonEnabled = ref(false);
	const showPopover = ref(false);
	const signingMessage = ref(false);
	const showEmojiPicker = ref(false);
	const fileUploadDialog = ref(false);
	const fileInfo = ref<File>();
	const uri = ref('');

	const caretPos = ref({ top: 0, left: 0 });

	const selectedAttributesSigningMessage = ref<string[]>(['irma-demo.sidn-pbdf.email.domain']);

	const elFileInput = ref<HTMLInputElement | null>(null);
	const elTextInput = ref<InstanceType<typeof TextArea> | null>(null);

	const sendMessageText = computed(() => {
		if (signingMessage.value) {
			return 'message.sign.send';
		}
		return 'message.send';
	});

	watch(route, () => {
		reset();
		closeMenus();
	});

	// Focus on message input if the state of messageActions changes (for example, when replying).
	const inputElement = ref<HTMLInputElement>();
	messageActions.$subscribe(() => {
		inputElement.value?.focus();
	});

	function checkButtonState() {
		buttonEnabled.value = false;
		if (value.value !== undefined) {
			if (typeof value.value === 'number') {
				buttonEnabled.value = true;
			}
			if (typeof value.value === 'string' && value.value.length > 0) {
				buttonEnabled.value = true;
			}
		}
	}

	//  To autocomplete the mention user in the message.
	function mentionUser(user: any) {
		let message = value.value?.toString();
		if (message?.lastIndexOf('@') !== -1) {
			const lastPosition = message?.lastIndexOf('@');
			message = message?.substring(0, lastPosition);
			value.value = ' ';
			value.value = message + ' @' + user.rawDisplayName;
		} else {
			value.value += ' @' + user.rawDisplayName;
		}
	}

	function clickedEmoticon(emoji: string) {
		value.value += emoji;
		elTextInput.value?.$el.focus();
		checkButtonState();
	}

	function uploadFile(event: Event) {
		const accessToken = pubhubs.Auth.getAccessToken();
		const target = event.currentTarget as HTMLInputElement;
		//const dialog = useDialog();
		uploadHandler(accessToken, uploadUrl, allTypes, event, (url) => {
			if (target) {
				const file = target.files && target.files[0];
				if (file) {
					// Once the file has been selected from the filesystem.
					// Set props to be passed to the component.
					fileInfo.value = file;
					uri.value = url;
					// display the component.
					fileUploadDialog.value = true;
				}
			}
		});
	}

	function clickedAttachment() {
		elFileInput.value?.click();
	}

	function submitMessage() {
		if (!value.value || !(typeof value.value === 'string')) return;

		if (signingMessage.value) {
			signMessage(value.value, selectedAttributesSigningMessage.value);
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
		reset();
	});

	function togglePopover() {
		messageActions.replyingTo = undefined;
		showPopover.value = !showPopover.value;
	}

	function showSigningMessageMenu() {
		showPopover.value = false;
		signingMessage.value = true;
	}

	function setCaretPos(pos: { top: number; left: number }) {
		caretPos.value = pos;
	}

	function closeMenus() {
		closeReplyingTo();
		showPopover.value = false;
		showEmojiPicker.value = false;
		signingMessage.value = false;
		fileUploadDialog.value = false;
	}

	function closeReplyingTo() {
		messageActions.replyingTo = undefined;
	}
</script>
