<template>
	<div class="w-full px-3 pb-3 md:px-6">
		<!-- Floating -->
		<div class="relative">
			<Popover v-if="showPopover" @close="togglePopover" class="absolute bottom-4">
				<div class="flex items-center">
					<UploadPicker @click="clickedAttachment" class="hover:bg-surface" />
					<SignedMessageButton v-if="!signingMessage" @click.stop="toggleSigningMessage(true)" class="hover:bg-surface" />
				</div>
			</Popover>
			<Mention v-if="showMention" :msg="value" :top="caretPos.top" :left="caretPos.left" :room="room" @click="mentionUser($event)" />
			<div v-if="showEmojiPicker" class="absolute bottom-2 right-0 z-20 xs:right-4 md:right-12">
				<EmojiPicker @emojiSelected="clickedEmoticon" @close="toggleEmojiPicker" />
			</div>
		</div>

		<div class="flex max-h-12 items-end justify-between gap-2 md:max-h-[50vh]">
			<div class="w-full overflow-hidden rounded-xl bg-surface-high shadow-sm">
				<!-- In reply to -->
				<div class="flex h-10 items-center justify-between gap-2 px-2" v-if="inReplyTo">
					<div class="flex w-fit gap-2 overflow-hidden">
						<p class="text-nowrap">{{ $t('message.in_reply_to') }}</p>
						<Suspense>
							<MessageSnippet :eventId="messageActions.replyingTo ?? ''" :room="room" />
							<template #fallback>
								<div class="flex items-center gap-3 rounded-md px-2">
									<p>{{ $t('state.loading_message') }}</p>
								</div>
							</template>
						</Suspense>
					</div>
					<button @click="messageActions.replyingTo = undefined">
						<Icon type="closingCross" size="sm" />
					</button>
				</div>

				<div class="flex items-end gap-x-4 rounded-2xl px-4 py-2">
					<Icon type="paperclip" size="md" @click.stop="togglePopover" :asButton="true" />
					<!-- Overflow-x-hidden prevents firefox from adding an extra row to the textarea for a possible scrollbar -->

					<TextArea
						ref="elTextInput"
						class="max-h-40 overflow-x-hidden border-none bg-transparent ~text-label-min/label-max placeholder:text-on-surface-variant md:max-h-60"
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
					/>

					<!--Steward and above can broadcast only in main time line-->
					<div
						v-if="room.getPowerLevel(user.user.userId) >= 50 && !inThread && !room.isPrivateRoom()"
						class="flex aspect-square h-6 w-6 justify-center"
						:class="!buttonEnabled && 'opacity-50 hover:cursor-default'"
						@click="isValidMessage() ? announcementMessage() : null"
					>
						<Icon type="announcement" size="md"></Icon>
					</div>

					<!-- Emoji picker -->
					<Icon type="emoticon" :iconColor="'text-background dark:text-on-surface-variant'" size="md" @click.stop="toggleEmojiPicker" :asButton="true" class="rounded-full bg-accent-secondary" />

					<!-- Sendbutton -->
					<Button class="flex aspect-square h-7 w-7 items-center justify-center !rounded-full bg-background !p-0" :class="!buttonEnabled && 'opacity-50 hover:cursor-default'" :disabled="!buttonEnabled" @click="submitMessage">
						<Icon type="send" size="sm" class="shrink-0 text-on-surface-variant" />
					</Button>
				</div>

				<div v-if="signingMessage" class="m-4 mt-0 flex items-center rounded-md bg-surface-low p-2">
					<Icon type="sign" size="base" class="mt-1 self-start" />
					<div class="ml-2 flex max-w-3xl flex-col justify-between">
						<h3 class="font-bold">{{ $t('message.sign.heading') }}</h3>
						<p>{{ $t('message.sign.info') }}</p>
						<div class="mt-2 flex items-center">
							<Icon type="warning" size="sm" class="mb-[2px] mr-2 mt-1 shrink-0 self-start" />
							<p class="italic">{{ $t('message.sign.warning') }}</p>
						</div>
						<Line class="mb-2" />
						<p>{{ $t('message.sign.selected_attributes') }}</p>
						<div class="mt-1 flex w-20 justify-center rounded-full">
							<p>Email</p>
						</div>
					</div>
					<Icon type="closingCross" size="sm" :asButton="true" @click.stop="toggleSigningMessage(false)" class="ml-auto self-start" />
				</div>
			</div>

			<!-- Yivi signing qr popup -->
			<div class="absolute bottom-[10%] left-1/2 w-fit -translate-x-1/2" v-show="showYiviQR">
				<Icon type="close" class="absolute left-[23.5rem] z-10 cursor-pointer dark:text-black" @click="showYiviQR = false" />
				<div v-if="signingMessage" id="yivi-web-form"></div>
			</div>
		</div>
		<FileUploadDialog
			:file="fileInfo"
			:blobURL="uri"
			:thread-id="threadRoot?.event_id"
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
</template>

<script setup lang="ts">
	// Components
	import { onMounted, onUnmounted, ref, watch } from 'vue';
	import { useRoute } from 'vue-router';
	import { useFormInputEvents, usedEvents } from '@/logic/composables/useFormInputEvents';
	import { useMatrixFiles } from '@/logic/composables/useMatrixFiles';
	import filters from '@/logic/core/filters';
	import { usePubHubs } from '@/logic/core/pubhubsStore';
	import { useMessageActions } from '@/logic/store/message-actions';
	import { useRooms } from '@/logic/store/store';
	import { useUser } from '@/logic/store/user';
	import { TMessageEvent } from '@/model/events/TMessageEvent';
	import Room from '@/model/rooms/Room';
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

	const user = useUser();
	const route = useRoute();
	const rooms = useRooms();
	const pubhubs = usePubHubs();
	const messageActions = useMessageActions();

	const props = defineProps({
		room: {
			type: Room,
			required: true,
		},
		inThread: {
			type: Boolean,
			default: false,
		},
	});

	const emit = defineEmits(usedEvents);
	const { value, reset, changed, cancel } = useFormInputEvents(emit);
	const { allTypes, getTypesAsString } = useMatrixFiles();

	const buttonEnabled = ref<boolean>(false);
	const showPopover = ref<boolean>(false);
	const signingMessage = ref<boolean>(false);
	const showYiviQR = ref<boolean>(false);
	const showEmojiPicker = ref<boolean>(false);
	const showMention = ref<boolean>(true); // Mentions may always be shown, except when another popup is shown
	const showFileUploadDialog = ref<boolean>(false);
	const fileUploading = ref<boolean>(false); // to hide other dialogs while in the file upload process
	const fileInfo = ref<File>();
	const uri = ref<string>('');

	const caretPos = ref({ top: 0, left: 0 });

	const selectedAttributesSigningMessage = ref<string[]>(['pbdf.sidn-pbdf.email.email']);

	const elFileInput = ref<HTMLInputElement | null>(null);
	const elTextInput = ref<InstanceType<typeof TextArea> | null>(null);
	const inReplyTo = ref<TMessageEvent | undefined>(undefined);

	let threadRoot: TMessageEvent | undefined = undefined;

	watch(route, () => {
		reset();
		toggleMenus(undefined);
	});

	watch(
		() => props.room.roomId,
		async () => {
			if (props.room.getCurrentThreadId()) {
				threadRoot = (await pubhubs.getEvent(rooms.currentRoomId, props.room.getCurrentThreadId() as string)) as TMessageEvent;
			} else {
				threadRoot = undefined;
			}
		},
		{ immediate: true },
	);

	watch(
		() => props.room.getCurrentThreadId(),
		async () => {
			if (props.inThread) {
				if (props.room.getCurrentThreadId()) {
					threadRoot = (await pubhubs.getEvent(rooms.currentRoomId, props.room.getCurrentThreadId() as string)) as TMessageEvent;
				} else {
					threadRoot = undefined;
				}
			}
		},
	);

	onMounted(async () => {
		window.addEventListener('keydown', handleKeydown);
		reset();
	});

	onUnmounted(() => {
		window.removeEventListener('keydown', handleKeydown);
	});

	// Focus on message input if the state of messageActions changes (for example, when replying).
	messageActions.$subscribe(async () => {
		inReplyTo.value = undefined;

		// If we are replying to a message, we need to check if the message is a thread or not
		// if the message is in a thread we can only set inReplyTo if we are in a thread
		// if the message is not in a thread we can only set inReplyTo if we are not in a thread
		if (messageActions.replyingTo) {
			const message = ((await pubhubs.getEvent(rooms.currentRoomId, messageActions.replyingTo)) as TMessageEvent) ?? undefined;
			if (message?.content['m.relates_to']?.['rel_type'] === 'm.thread') {
				inReplyTo.value = props.inThread ? message : undefined;
			} else {
				inReplyTo.value = !props.inThread ? message : undefined;
			}
		}

		elTextInput.value?.$el.focus();
	});

	function clickedEmoticon(emoji: string) {
		value.value += emoji;
		elTextInput.value?.$el.focus();
		checkButtonState();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (signingMessage.value) {
			toggleMenus(signingMessage);
		} else {
			toggleMenus(undefined);
		}
		if (event.key === 'Escape') {
			signingMessage.value = false;
			showYiviQR.value = false;
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
		toggleMenus(signingMessage);
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
			showYiviQR.value = true;
			pubhubs.signAndSubmitMessage(value.value!.toString(), selectedAttributesSigningMessage.value, threadRoot).then(() => {
				signingMessage.value = false;
				value.value = '';
				showYiviQR.value = false;
			});
		} else {
			pubhubs.submitMessage(value.value!.toString(), rooms.currentRoomId, threadRoot, inReplyTo.value);
			value.value = '';
		}
	}

	async function announcementMessage() {
		const powerLevel = props.room.getPowerLevel(user.user.userId);
		// if (value.value?.toLocaleString().length === 0) return;
		await pubhubs.addAnnouncementMessage(rooms.currentRoomId, value.value!.toString(), powerLevel);
		value.value = '';
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
		signingMessage.value = Object.is(from, signingMessage) ? signingMessage.value : false;
		showYiviQR.value = Object.is(from, signingMessage) ? showYiviQR.value : false;
		showMention.value = Object.is(from, showMention) ? true : !fileUploading.value && !showPopover.value && !showEmojiPicker.value; // either true (from focus) or dependent of other popups
		elFileInput.value = null;
	}

	function closeReplyingTo() {
		messageActions.replyingTo = undefined;
	}
</script>
