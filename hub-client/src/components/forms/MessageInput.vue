<template>
	<div class="w-full px-3 pb-3 md:px-6">
		<!-- Floating -->
		<div class="relative">
			<Popover v-if="state.popover" @close="togglePopover()" class="absolute bottom-4">
				<div class="flex items-center">
					<PopoverButton icon="upload" @click="clickedAttachment">{{ $t('message.upload_file') }}</PopoverButton>
					<template v-if="settings.isFeatureEnabled(FeatureFlag.votingWidget) && !inThread && !inReplyTo">
						<PopoverButton icon="poll" @click="openPoll()">{{ $t('message.poll') }}</PopoverButton>
						<PopoverButton icon="scheduler" @click="openScheduler()">{{ $t('message.scheduler') }}</PopoverButton>
					</template>
					<PopoverButton icon="sign" v-if="!state.signMessage && settings.isFeatureEnabled(FeatureFlag.signedMessages)" @click="openSignMessage()">{{ $t('message.sign.add_signature') }}</PopoverButton>
				</div>
			</Popover>
			<Mention v-if="state.showMention" :msg="value" :top="caretPos.top" :left="caretPos.left" :room="room" @click="mentionUser($event)" />
			<div v-if="state.emojiPicker" class="absolute bottom-2 right-0 z-20 xs:right-4 md:right-12">
				<EmojiPicker @emojiSelected="clickedEmoticon" @close="toggleEmojiPicker()" />
			</div>
		</div>

		<div class="flex max-h-12 items-end justify-between gap-2 md:max-h-[50vh]">
			<div class="w-full rounded-xl bg-surface-high shadow-sm">
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

				<template v-if="settings.isFeatureEnabled(FeatureFlag.votingWidget)">
					<PollMessageInput v-if="state.poll" :poll-object="state.pollObject" :isEdit="isEdit()" @create-poll="createPoll" @send-poll="submitMessage" @edit-poll="editMessage" @close-poll="closePoll()" />
					<SchedulerMessageInput
						v-if="state.scheduler"
						:scheduler-object="state.schedulerObject"
						:isEdit="isEdit()"
						@create-scheduler="createScheduler"
						@send-scheduler="submitMessage"
						@edit-scheduler="editMessage"
						@close-scheduler="closeScheduler()"
					/>
				</template>

				<div v-if="state.textArea" class="flex items-end gap-x-4 rounded-2xl px-4 py-2">
					<Icon type="paperclip" size="md" @click.stop="togglePopover()" :asButton="true" />
					<!-- Overflow-x-hidden prevents firefox from adding an extra row to the textarea for a possible scrollbar -->
					<TextArea
						ref="elTextInput"
						class="max-h-40 overflow-x-hidden border-none bg-transparent ~text-label-min/label-max placeholder:text-on-surface-variant md:max-h-60"
						v-focus
						:placeholder="$t('rooms.new_message')"
						:title="$t('rooms.new_message')"
						v-model="value"
						@changed="changed()"
						@submit="submitMessage()"
						@cancel="cancel()"
						@caretPos="setCaretPos"
					/>

					<!--Steward and above can broadcast only in main time line-->
					<div
						v-if="room.getPowerLevel(user.user.userId) >= 50 && !inThread && !room.isPrivateRoom()"
						class="flex aspect-square h-6 w-6 justify-center"
						:class="!state.sendButtonEnabled && 'opacity-50 hover:cursor-default'"
						@click="isValidMessage() ? announcementMessage() : null"
					>
						<Icon type="announcement" size="md"></Icon>
					</div>

					<!-- Emoji picker -->
					<Icon type="emoticon" :iconColor="'text-background dark:text-on-surface-variant'" size="md" @click.stop="toggleEmojiPicker()" :asButton="true" class="rounded-full bg-accent-secondary" />

					<!-- Sendbutton -->
					<Button
						class="flex aspect-square h-7 w-7 items-center justify-center !rounded-full bg-background !p-0"
						:class="!state.sendButtonEnabled && 'opacity-50 hover:cursor-default'"
						:disabled="!state.sendButtonEnabled"
						@click="submitMessage"
					>
						<Icon type="send" size="sm" class="shrink-0 text-on-surface-variant" />
					</Button>
				</div>

				<div v-if="state.signMessage" class="m-4 mt-0 flex items-center rounded-md bg-surface-low p-2">
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
					<Icon type="closingCross" size="sm" :asButton="true" @click.stop="resetAll(true)" class="ml-auto self-start" />
				</div>
			</div>

			<!-- Yivi signing qr popup -->
			<div class="absolute bottom-[10%] left-1/2 w-min -translate-x-1/2" v-show="state.showYiviQR">
				<Icon type="close" class="absolute right-2 z-10 cursor-pointer dark:text-black" @click="state.showYiviQR = false" />
				<div v-if="state.signMessage" id="yivi-web-form"></div>
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
	import Popover from '../ui/Popover.vue';
	import TextArea from './TextArea.vue';
	import Button from '../elements/Button.vue';
	import Icon from '../elements/Icon.vue';
	import EmojiPicker from '../ui/EmojiPicker.vue';
	import Mention from '../ui/Mention.vue';
	import Line from '../elements/Line.vue';
	import FileUploadDialog from '../ui/FileUploadDialog.vue';
	import MessageSnippet from '../rooms/MessageSnippet.vue';
	import PollMessageInput from '@/components/rooms/voting/poll/PollMessageInput.vue';
	import SchedulerMessageInput from '@/components/rooms/voting/scheduler/SchedulerMessageInput.vue';
	import PopoverButton from '../ui/PopoverButton.vue';

	import { useFormInputEvents, usedEvents } from '@/logic/composables/useFormInputEvents';
	import { onMounted, onUnmounted, PropType, ref, watch } from 'vue';
	import { useMatrixFiles } from '@/logic/composables/useMatrixFiles';
	import filters from '@/logic/core/filters';
	import { usePubHubs } from '@/logic/core/pubhubsStore';
	import { useMessageActions } from '@/logic/store/message-actions';
	import { useMessageInputComposable } from '@/logic/store/messageInput';
	import Room from '@/model/rooms/Room';
	import { useRooms } from '@/logic/store/store';
	import { useRoute } from 'vue-router';
	import { useUser } from '@/logic/store/user';
	import { FeatureFlag, useSettings } from '@/logic/store/settings';
	import { YiviSigningSessionResult } from '@/model/components/signedMessages';
	import { TMessageEvent } from '@/model/events/TMessageEvent';
	import { Scheduler, Poll } from '@/model/events/voting/VotingTypes';

	const user = useUser();
	const route = useRoute();
	const rooms = useRooms();
	const pubhubs = usePubHubs();
	const settings = useSettings();
	const messageActions = useMessageActions();
	const { state, togglePopover, isEdit, resetAll, hasActivePopup, openTextArea, toggleEmojiPicker, openSignMessage, openPoll, closePoll, editPoll, openScheduler, closeScheduler, editScheduler } = useMessageInputComposable();

	const props = defineProps({
		room: {
			type: Room,
			required: true,
		},
		inThread: {
			type: Boolean,
			default: false,
		},
		editingPoll: {
			type: Object as PropType<{ poll: Poll; eventId: string }>,
			default: undefined,
		},
		editingScheduler: {
			type: Object as PropType<{ scheduler: Scheduler; eventId: string }>,
			default: undefined,
		},
	});

	const emit = defineEmits(usedEvents);
	const { value, reset, changed, cancel } = useFormInputEvents(emit);
	const { allTypes, getTypesAsString } = useMatrixFiles();

	const showFileUploadDialog = ref<boolean>(false);
	const fileUploading = ref<boolean>(false); // to hide other dialogs while in the file upload process
	const fileInfo = ref<File>();
	const uri = ref<string>('');
	const pollObject = ref<Poll>(new Poll());
	const schedulerObject = ref<Scheduler>(new Scheduler());

	const caretPos = ref({ top: 0, left: 0 });

	const selectedAttributesSigningMessage = ref<string[]>(['pbdf.sidn-pbdf.email.email']);

	const elFileInput = ref<HTMLInputElement | null>(null);
	const elTextInput = ref<InstanceType<typeof TextArea> | null>(null);
	const inReplyTo = ref<TMessageEvent | undefined>(undefined);

	let threadRoot: TMessageEvent | undefined = undefined;

	watch(route, () => {
		reset();
		resetAll();
	});

	watch(value, () => {
		state.sendButtonEnabled = isValidMessage();
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

	watch(
		() => props.editingPoll,
		() => {
			if (props.editingPoll) {
				editPoll(props.editingPoll.poll, props.editingPoll.eventId);
				pollObject.value = props.editingPoll.poll;
			}
		},
	);

	watch(
		() => props.editingScheduler,
		() => {
			if (props.editingScheduler) {
				editScheduler(props.editingScheduler.scheduler, props.editingScheduler.eventId);
				schedulerObject.value = props.editingScheduler.scheduler;
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
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!hasActivePopup() || event.key === 'Escape') {
			resetAll();
			state.sendButtonEnabled = isValidMessage();
		}
	}

	function isValidMessage(): boolean {
		let valid = false;
		// TextAreas always return strings, so the message is valid to send if it is a string with a length > 0
		if (typeof value.value === 'string' && value.value.trim().length > 0) valid = true;
		if ((state.poll || state.scheduler) && state.sendButtonEnabled) valid = true;
		return valid;
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
		// This makes sure value.value is not undefined
		if (!state.sendButtonEnabled || !isValidMessage()) return;

		if (state.signMessage) {
			state.showYiviQR = true;
			signMessage(value.value!.toString(), selectedAttributesSigningMessage.value, threadRoot);
		} else if (messageActions.replyingTo && inReplyTo.value) {
			pubhubs.addMessage(rooms.currentRoomId, value.value!.toString(), threadRoot, inReplyTo.value);
			messageActions.replyingTo = undefined;
			value.value = '';
		} else if (state.poll) {
			sendPoll();
			value.value = '';
		} else if (state.scheduler) {
			sendScheduler();
			value.value = '';
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

	function editMessage() {
		if (state.poll && pollObject.value.canSend()) {
			pollObject.value.removeEmptyOptions();
			pubhubs.editPoll(rooms.currentRoomId, state.editEventId as string, pollObject.value as Poll);
			openTextArea();
		} else if (state.scheduler && schedulerObject.value.canSend()) {
			pubhubs.editScheduler(rooms.currentRoomId, state.editEventId as string, schedulerObject.value as Scheduler);
			openTextArea();
		}
	}

	function signMessage(message: string, attributes: string[], threadRoot: TMessageEvent | undefined) {
		rooms.yiviSignMessage(message, attributes, rooms.currentRoomId, threadRoot, finishedSigningMessage);
	}

	function finishedSigningMessage(result: YiviSigningSessionResult, threadRoot: TMessageEvent | undefined) {
		pubhubs.addSignedMessage(rooms.currentRoomId, result, threadRoot);
		state.showYiviQR = false;
		state.signMessage = false;
		value.value = '';
	}

	const createScheduler = (scheduler: Scheduler, canSend: boolean) => {
		schedulerObject.value = scheduler;
		state.sendButtonEnabled = canSend;
	};

	function sendScheduler() {
		pubhubs.addScheduler(rooms.currentRoomId, schedulerObject.value as Scheduler);
		openTextArea();
	}

	const createPoll = (poll: Poll, canSend: boolean) => {
		pollObject.value = poll;
		state.sendButtonEnabled = canSend;
	};

	function sendPoll() {
		pollObject.value.removeEmptyOptions();
		pubhubs.addPoll(rooms.currentRoomId, pollObject.value as Poll);
		openTextArea();
	}

	function setCaretPos(pos: { top: number; left: number }) {
		caretPos.value = pos;
	}
</script>
