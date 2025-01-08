<template>
	<div class="flex gap-2 items-end pb-3 pl-3 sm:px-6">
		<div class="min-w-3/4 w-[90%] relative rounded-xl bg-hub-background-4 dark:bg-hub-background-4">
			<!-- Floating -->
			<div>
				<Popover v-if="showPopover" @close="togglePopover" class="absolute bottom-[115%]">
					<div class="flex items-center">
						<UploadPicker @click="clickedAttachment"></UploadPicker>
						<SignedMessageButton v-if="!signingMessage" @click.stop="toggleSigningMessage(true)"> </SignedMessageButton>
					</div>
				</Popover>
				<Mention v-if="showMention" :msg="value" :top="caretPos.top" :left="caretPos.left" :room="room" @click="mentionUser($event)"></Mention>
				<div v-if="showEmojiPicker" class="absolute bottom-[115%] sm:right-0 z-20">
					<EmojiPicker @emojiSelected="clickedEmoticon" @close="toggleEmojiPicker" />
				</div>
			</div>

			<div class="h-10 w-full flex items-center" v-if="inReplyTo">
				<p class="ml-4 whitespace-nowrap mr-2">{{ $t('message.in_reply_to') }}</p>
				<Suspense>
					<MessageSnippet class="w-[85%]" :eventId="messageActions.replyingTo" :room="room"></MessageSnippet>
					<template #fallback>
						<div class="bg-hub-background-3 flex px-2 gap-3 items-center rounded-md">
							<p>{{ $t('state.loading_message') }}</p>
						</div>
					</template>
				</Suspense>
				<button class="mr-4 ml-auto" @click="messageActions.replyingTo = undefined">
					<Icon type="closingCross" size="sm"></Icon>
				</button>
			</div>

			<div class="flex items-start min-h-[50px] px-2 py-1 gap-x-2 rounded-2xl dark:bg-hub-background-4">
				<Icon class="dark:text-white self-end mb-1 pr-3 border-r-2 border-r-gray-light" type="paperclip" @click.stop="togglePopover" :asButton="true"></Icon>
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
				<Icon class="dark:text-white mb-1 self-end" type="emoticon" @click.stop="toggleEmojiPicker" :asButton="true"></Icon>
			</div>

			<div v-if="signingMessage" class="m-2 bg-gray-light dark:bg-hub-background flex items-center rounded-md p-2">
				<Icon type="sign" size="base" class="ml-2 mr-2 self-start mt-1 shrink-0"></Icon>
				<div class="ml-2 flex flex-col justify-between max-w-3xl">
					<h3 class="font-bold">{{ $t('message.sign.heading') }}</h3>
					<p>{{ $t('message.sign.info') }}</p>
					<div class="flex items-center mt-2">
						<Icon type="warning" size="sm" class="mb-[2px] mr-2 self-start mt-1 shrink-0"></Icon>
						<p class="italic">{{ $t('message.sign.warning') }}</p>
					</div>
					<Line class="mb-2"></Line>
					<p>{{ $t('message.sign.selected_attributes') }}</p>
					<div class="bg-black rounded-full w-20 flex justify-center mt-1 text-white">
						<p>Email</p>
					</div>
				</div>
				<Icon type="closingCross" size="sm" :asButton="true" @click.stop="toggleSigningMessage(false)" class="ml-auto self-start"></Icon>
			</div>
		</div>

		<!-- Sendbutton -->
		<Button class="min-h-[50px] flex rounded-xl" :disabled="!buttonEnabled" @click="submitMessage">
			<div class="flex gap-2 text-xl items-center">
				<Icon type="talk" size="sm" class="-scale-100 rotate-45 shrink-0"></Icon>
				<span class="hidden md:flex">{{ $t(sendMessageText) }}</span>
			</div>
		</Button>

		<!-- Yivi signing qr popup -->
		<div v-if="signingMessage" class="absolute bottom-[10%] md:left-[40%]" id="yivi-web-form"></div>

		<div class="text-black dark:bg-gray-dark dark:text-white">
			<FileUploadDialog :file="fileInfo" :mxcPath="uri" v-if="showFileUploadDialog" @close="showFileUploadDialog = false"> </FileUploadDialog>
			<!-- todo: move this into UploadPicker? -->
			<input type="file" :accept="getTypesAsString(allTypes)" class="attach-file" ref="elFileInput" @change="uploadFile($event)" @cancel="fileUploading = false" hidden />
		</div>
	</div>
</template>

<script setup lang="ts">
	// Components
	import Popover from '../ui/Popover.vue';
	import TextArea from './TextArea.vue';
	import Button from '../elements/Button.vue';
	import Icon from '../elements/Icon.vue';
	import EmojiPicker from '../ui/EmojiPicker.vue';
	import Mention from '../ui/Mention.vue';
	import UploadPicker from '../ui/UploadPicker.vue';
	import SignedMessageButton from '../ui/SignedMessageButton.vue';
	import Line from '../elements/Line.vue';
	import FileUploadDialog from '../ui/FileUploadDialog.vue';
	import MessageSnippet from '../rooms/MessageSnippet.vue';

	import { useFormInputEvents, usedEvents } from '@/composables/useFormInputEvents';
	import { useMatrixFiles } from '@/composables/useMatrixFiles';
	import filters from '@/core/filters';
	import { usePubHubs } from '@/core/pubhubsStore';
	import Room from '@/model/rooms/Room';
	import { useMessageActions } from '@/store/message-actions';
	import { useRooms } from '@/store/store';
	import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { useRoute } from 'vue-router';
	import { fileUpload } from '@/composables/fileUpload';
	import { YiviSigningSessionResult } from '@/lib/signedMessages';
	import { TMessageEvent } from '@/model/events/TMessageEvent';

	const { t } = useI18n();
	const route = useRoute();
	const rooms = useRooms();
	const pubhubs = usePubHubs();
	const messageActions = useMessageActions();

	const props = defineProps({ room: Room });
	const emit = defineEmits(usedEvents);
	const { value, reset, changed, cancel } = useFormInputEvents(emit);
	const { allTypes, getTypesAsString, uploadUrl } = useMatrixFiles();

	const buttonEnabled = ref<boolean>(false);
	const showPopover = ref<boolean>(false);
	const signingMessage = ref<boolean>(false);
	const showEmojiPicker = ref<boolean>(false);
	const showMention = ref<boolean>(true); // Mentions may always be shown, except when another popup is shown
	const showFileUploadDialog = ref<boolean>(false);
	const fileUploading = ref<boolean>(false); // to hide other dialogs while in the file upload process
	const fileInfo = ref<File>();
	const uri = ref<string>('');

	const caretPos = ref({ top: 0, left: 0 });

	const selectedAttributesSigningMessage = ref<string[]>(['irma-demo.sidn-pbdf.email.domain']);

	const elFileInput = ref<HTMLInputElement | null>(null);
	const elTextInput = ref<InstanceType<typeof TextArea> | null>(null);
	const inReplyTo = ref<TMessageEvent | undefined>(undefined);

	const sendMessageText = computed(() => {
		if (signingMessage.value) {
			return 'message.sign.send';
		}
		return 'message.send';
	});

	watch(route, () => {
		reset();
		toggleMenus(undefined);
	});

	onMounted(() => {
		window.addEventListener('keydown', handleKeydown);
		reset();
	});

	onUnmounted(() => {
		window.removeEventListener('keydown', handleKeydown);
	});

	// Focus on message input if the state of messageActions changes (for example, when replying).
	messageActions.$subscribe(async () => {
		inReplyTo.value = messageActions.replyingTo ? ((await pubhubs.getEvent(rooms.currentRoomId, messageActions.replyingTo)) as TMessageEvent) : undefined;
		elTextInput.value?.$el.focus();
	});

	function clickedEmoticon(emoji: string) {
		value.value += emoji;
		elTextInput.value?.$el.focus();
		checkButtonState();
	}

	function handleKeydown(event: KeyboardEvent) {
		toggleMenus(undefined);
		if (event.key === 'Escape') {
			signingMessage.value = false;
			showMention.value = false;
		}
	}

	function togglePopover() {
		closeReplyingTo();
		toggleMenus(showPopover);
	}

	function toggleEmojiPicker() {
		toggleMenus(showEmojiPicker);
	}

	function toggleSigningMessage(newValue: boolean) {
		signingMessage.value = newValue;
		setCaretPos({ top: 0, left: caretPos.value.left });
		toggleMenus(undefined);
	}

	function isValidMessage(): boolean {
		// TextAreas always return strings, so the message is valid to send if it is a string with a length > 0
		return typeof value.value === 'string' && value.value.trim().length > 0;
	}

	function checkButtonState() {
		buttonEnabled.value = isValidMessage();
	}

	function uploadFile(event: Event) {
		// display the component.
		const accessToken = pubhubs.Auth.getAccessToken();
		// TODO errorhandling
		if (!accessToken) {
			return;
		}
		const target = event.currentTarget as HTMLInputElement;
		const errorMsg = t('errors.file_upload');
		fileUpload(errorMsg, accessToken, uploadUrl, allTypes, event, (url) => {
			if (target) {
				const file = target.files && target.files[0];
				if (file) {
					// Once the file has been selected from the filesystem.
					// Set props to be passed to the component.
					fileInfo.value = file;
					uri.value = url;
					// display the component.
					showFileUploadDialog.value = true;
					// Inspiration from  https://dev.to/schirrel/vue-and-input-file-clear-file-or-select-same-file-24do
					const inputElement = elFileInput.value;
					if (inputElement) inputElement.value = '';
				}
			}
			fileUploading.value = false;
		});
	}

	function clickedAttachment() {
		fileUploading.value = true;
		elFileInput.value?.click();
	}

	//  To autocomplete the mention user in the message.
	function mentionUser(user: any) {
		let userMention = user.rawDisplayName;

		// Make sure pseudonym is included if it hasn't
		if (!filters.extractPseudonymFromString(userMention)) {
			userMention += ' - ' + filters.extractPseudonym(user.userId);
		}

		let message = value.value?.toString();
		if (message?.lastIndexOf('@') !== -1) {
			const lastPosition = message?.lastIndexOf('@');
			message = message?.substring(0, lastPosition);
			value.value = message + ' @' + userMention;
		} else {
			value.value += ' @' + userMention;
		}
	}

	function submitMessage() {
		if (!isValidMessage()) {
			return;
		} // This makes sure value.value is not undefined

		if (signingMessage.value) {
			signMessage(value.value!.toString(), selectedAttributesSigningMessage.value);
		} else if (messageActions.replyingTo && inReplyTo.value) {
			pubhubs.addMessage(rooms.currentRoomId, value.value!.toString(), inReplyTo.value);
			messageActions.replyingTo = undefined;
		} else {
			pubhubs.addMessage(rooms.currentRoomId, value.value!.toString());
		}

		value.value = '';
	}

	function signMessage(message: string, attributes: string[]) {
		rooms.yiviSignMessage(message, attributes, rooms.currentRoomId, finishedSigningMessage);
	}

	function finishedSigningMessage(result: YiviSigningSessionResult) {
		pubhubs.addSignedMessage(rooms.currentRoomId, result);
		signingMessage.value = false;
	}

	function setCaretPos(pos: { top: number; left: number }) {
		caretPos.value = pos;
	}

	// display of menus is dependant of each other.
	// so we pass the boolean that controls the visibility of a dialog and we toggle that boolean
	// the other dialogs are hidden
	function toggleMenus(from: object | undefined) {
		showPopover.value = Object.is(from, showPopover) ? !showPopover.value : false;
		showEmojiPicker.value = Object.is(from, showEmojiPicker) ? !showEmojiPicker.value : false;
		showMention.value = Object.is(from, showMention) ? true : !fileUploading.value && !showPopover.value && !showEmojiPicker.value; // either true (from focus) or dependent of other popups
		elFileInput.value = null;
	}

	function closeReplyingTo() {
		messageActions.replyingTo = undefined;
	}
</script>
