<template>
	<div class="-mt-2 w-full px-3 pb-3 md:px-6">
		<!-- Floating -->
		<div class="relative">
			<Popover v-if="showPopover" @close="togglePopover" class="absolute bottom-2">
				<div class="flex items-center">
					<UploadPicker @click="clickedAttachment"></UploadPicker>
					<SignedMessageButton v-if="!signingMessage" @click.stop="toggleSigningMessage(true)"> </SignedMessageButton>
				</div>
			</Popover>
			<Mention v-if="showMention" :msg="value" :top="caretPos.top" :left="caretPos.left" :room="room" @click="mentionUser($event)"></Mention>
			<div v-if="showEmojiPicker" class="absolute bottom-2 right-0 z-20 xs:right-4 md:right-32">
				<EmojiPicker @emojiSelected="clickedEmoticon" @close="toggleEmojiPicker" />
			</div>
		</div>

		<div class="flex max-h-12 items-end justify-between gap-2 md:max-h-52">
			<div class="w-full overflow-hidden rounded-xl bg-hub-background-2">
				<!-- In reply to -->
				<div class="flex h-10 items-center justify-between gap-2 px-2" v-if="inReplyTo">
					<div class="flex w-fit gap-2 overflow-hidden">
						<p class="text-nowrap">{{ $t('message.in_reply_to') }}</p>
						<Suspense>
							<MessageSnippet :eventId="messageActions.replyingTo" :room="room"></MessageSnippet>
							<template #fallback>
								<div class="flex items-center gap-3 rounded-md px-2">
									<p>{{ $t('state.loading_message') }}</p>
								</div>
							</template>
						</Suspense>
					</div>
					<button @click="messageActions.replyingTo = undefined">
						<Icon type="closingCross" size="sm"></Icon>
					</button>
				</div>

				<div class="flex min-h-[50px] items-center gap-x-4 rounded-2xl px-4 py-2">
					<Icon class="dark:text-white" type="paperclip" size="md" @click.stop="togglePopover" :asButton="true"></Icon>
					<!-- Overflow-x-hidden prevents firefox from adding an extra row to the textarea for a possible scrollbar -->
					<TextArea
						ref="elTextInput"
						class="max-h-40 overflow-x-hidden border-none bg-transparent placeholder:text-gray-dark dark:placeholder:text-gray-lighter md:max-h-60"
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

					<!-- Emoji picker -->
					<Icon class="dark:text-white" type="emoticon" size="md" @click.stop="toggleEmojiPicker" :asButton="true"></Icon>

					<!-- Sendbutton -->
					<Button
						class="flex aspect-square h-7 w-7 items-center justify-center !rounded-full bg-hub-background-4 !p-0"
						:class="!buttonEnabled && 'opacity-25 hover:cursor-default'"
						:disabled="!buttonEnabled"
						@click="submitMessage"
					>
						<Icon type="send" size="sm" class="shrink-0"></Icon>
					</Button>
				</div>

				<div v-if="signingMessage" class="m-4 mt-0 flex items-center rounded-md bg-hub-background-4 p-2">
					<Icon type="sign" size="base" class="mt-1 self-start"></Icon>
					<div class="ml-2 flex max-w-3xl flex-col justify-between">
						<h3 class="font-bold">{{ $t('message.sign.heading') }}</h3>
						<p>{{ $t('message.sign.info') }}</p>
						<div class="mt-2 flex items-center">
							<Icon type="warning" size="sm" class="mb-[2px] mr-2 mt-1 shrink-0 self-start"></Icon>
							<p class="italic">{{ $t('message.sign.warning') }}</p>
						</div>
						<Line class="mb-2"></Line>
						<p>{{ $t('message.sign.selected_attributes') }}</p>
						<div class="mt-1 flex w-20 justify-center rounded-full bg-black text-white">
							<p>Email</p>
						</div>
					</div>
					<Icon type="closingCross" size="sm" :asButton="true" @click.stop="toggleSigningMessage(false)" class="ml-auto self-start"></Icon>
				</div>
			</div>

			<!-- Yivi signing qr popup -->
			<div v-if="signingMessage" class="absolute bottom-[10%] md:left-[40%]" id="yivi-web-form"></div>
		</div>
		<div class="text-black dark:bg-gray-dark dark:text-white">
			<FileUploadDialog
				:file="fileInfo"
				:blobURL="uri"
				v-if="showFileUploadDialog"
				@close="
					showFileUploadDialog = false;
					fileUploading = false;
				"
			>
			</FileUploadDialog>
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

	import { useFormInputEvents, usedEvents } from '@/logic/composables/useFormInputEvents';
	import { useMatrixFiles } from '@/logic/composables/useMatrixFiles';
	import filters from '@/logic/core/filters';
	import { usePubHubs } from '@/logic/core/pubhubsStore';
	import { useMessageActions } from '@/logic/store/message-actions';
	import { useRooms } from '@/logic/store/store';
	import { onMounted, onUnmounted, ref, watch } from 'vue';
	import { useRoute } from 'vue-router';
	import { YiviSigningSessionResult } from '@/model/components/signedMessages';
	import { TMessageEvent } from '@/model/events/TMessageEvent';

	const route = useRoute();
	const rooms = useRooms();
	const pubhubs = usePubHubs();
	const messageActions = useMessageActions();

	const emit = defineEmits(usedEvents);
	const { value, reset, changed, cancel } = useFormInputEvents(emit);
	const { allTypes, getTypesAsString } = useMatrixFiles();

	const buttonEnabled = ref<boolean>(false);
	const showPopover = ref<boolean>(false);
	const signingMessage = ref<boolean>(false);
	const showEmojiPicker = ref<boolean>(false);
	const showMention = ref<boolean>(true); // Mentions may always be shown, except when another popup is shown
	const showFileUploadDialog = ref<boolean>(false);
	const fileUploading = ref<boolean>(false); // to hide other dialogs while in the file upload process
	const fileInfo = ref<File>();
	const uri = ref<string>('');
	import Room from '@/model/rooms/Room';

	const caretPos = ref({ top: 0, left: 0 });

	const selectedAttributesSigningMessage = ref<string[]>(['irma-demo.sidn-pbdf.email.domain']);

	const elFileInput = ref<HTMLInputElement | null>(null);
	const elTextInput = ref<InstanceType<typeof TextArea> | null>(null);
	const inReplyTo = ref<TMessageEvent | undefined>(undefined);
	defineProps<{ room: Room }>();

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
		const target = event.currentTarget as HTMLInputElement;
		const file = target.files && target.files[0];
		if (file) {
			// Once the file has been selected from the filesystem.
			// Set props to be passed to the component.
			fileInfo.value = file;
			uri.value = URL.createObjectURL(file);
			// display the component.
			showFileUploadDialog.value = true;
			// Inspiration from  https://dev.to/schirrel/vue-and-input-file-clear-file-or-select-same-file-24do
			const inputElement = elFileInput.value;
			if (inputElement) inputElement.value = '';
		}
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
