<template>
	<div class="w-full px-3 pb-3 md:px-6">
		<!-- Floating -->
		<div class="relative">
			<Popover v-if="messageInput.state.popover" @close="messageInput.togglePopover()" class="absolute bottom-4">
				<div class="flex items-center">
					<PopoverButton icon="upload-simple" data-testid="upload" @click="clickedAttachment">{{ $t('message.upload_file') }}</PopoverButton>
					<template v-if="settings.isFeatureEnabled(FeatureFlag.votingWidget) && !inThread && !inReplyTo">
						<PopoverButton icon="chart-bar" data-testid="poll" @click="messageInput.openPoll()">{{ $t('message.poll') }}</PopoverButton>
						<PopoverButton icon="calendar" data-testid="scheduler" @click="messageInput.openScheduler()">{{ $t('message.scheduler') }}</PopoverButton>
					</template>
					<PopoverButton icon="pen-nib" data-testid="sign" v-if="!messageInput.state.signMessage && settings.isFeatureEnabled(FeatureFlag.signedMessages)" @click="messageInput.openSignMessage()">{{
						$t('message.sign.add_signature')
					}}</PopoverButton>
				</div>
			</Popover>
			<Mention v-if="messageInput.state.showMention" :msg="value as string" :top="caretPos.top" :left="caretPos.left" :room="room" @click="mentionUser($event)" />
			<MentionRoom v-if="messageInput.state.showMention" :msg="value as string" :top="caretPos.top" :left="caretPos.left" :room="room" @click="mentionRoom($event)" />
			<div v-if="messageInput.state.emojiPicker" class="absolute bottom-2 right-0 z-20 xs:right-4 md:right-12">
				<EmojiPicker @emojiSelected="clickedEmoticon" @close="messageInput.toggleEmojiPicker()" />
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
						<Icon type="x" size="sm" />
					</button>
				</div>

				<FilePicker ref="filePickerEl" :messageInput="messageInput"></FilePicker>

				<template v-if="settings.isFeatureEnabled(FeatureFlag.votingWidget)">
					<PollMessageInput
						v-if="messageInput.state.poll"
						:poll-object="messageInput.state.pollObject"
						:isEdit="messageInput.isEdit.value"
						@create-poll="createPoll"
						@send-poll="submitMessage"
						@edit-poll="editMessage"
						@close-poll="messageInput.closePoll()"
					/>
					<SchedulerMessageInput
						v-if="messageInput.state.scheduler"
						:scheduler-object="messageInput.state.schedulerObject"
						:isEdit="messageInput.isEdit.value"
						@create-scheduler="createScheduler"
						@send-scheduler="submitMessage"
						@edit-scheduler="editMessage"
						@close-scheduler="messageInput.closeScheduler()"
					/>
				</template>

				<div v-if="messageInput.state.textArea" class="flex items-center gap-x-4 rounded-2xl px-4 py-2">
					<IconButton type="plus-circle" data-testid="paperclip" size="lg" @click.stop="messageInput.togglePopover()" />
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
					<button
						v-if="room.getPowerLevel(user.user.userId) >= 50 && !inThread && !room.isPrivateRoom() && !room.isGroupRoom()"
						:class="!messageInput.state.sendButtonEnabled && 'opacity-50 hover:cursor-default'"
						@click="isValidMessage() ? announcementMessage() : null"
					>
						<Icon type="megaphone-simple" size="lg"></Icon>
					</button>

					<!-- Emoji picker -->
					<button>
						<Icon type="smiley" size="lg" @click.stop="messageInput.toggleEmojiPicker()" />
					</button>

					<!-- Sendbutton -->
					<button :title="$t('message.send')" :class="!messageInput.state.sendButtonEnabled && 'opacity-50 hover:cursor-default'" :disabled="!messageInput.state.sendButtonEnabled" @click="submitMessage">
						<Icon type="paper-plane-right" size="lg" />
					</button>
				</div>

				<div v-if="messageInput.state.signMessage" class="m-4 mt-0 flex items-center rounded-md bg-surface-low p-2">
					<Icon type="pen-nib" size="base" class="mt-1 self-start" />
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
					<IconButton type="x" size="sm" @click.stop="messageInput.resetAll(true)" class="ml-auto self-start" />
				</div>
			</div>

			<!-- Yivi signing qr popup -->
			<div class="absolute bottom-[10%] left-1/2 w-min -translate-x-1/2" v-show="messageInput.state.showYiviQR">
				<Icon type="x" class="absolute right-2 z-10 cursor-pointer dark:text-black" @click="messageInput.state.showYiviQR = false" />
				<div v-if="messageInput.state.signMessage" id="yivi-web-form"></div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { PropType, onMounted, onUnmounted, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { useRoute } from 'vue-router';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import Line from '@hub-client/components/elements/Line.vue';
	import TextArea from '@hub-client/components/forms/TextArea.vue';
	import MessageSnippet from '@hub-client/components/rooms/MessageSnippet.vue';
	import PollMessageInput from '@hub-client/components/rooms/voting/poll/PollMessageInput.vue';
	import SchedulerMessageInput from '@hub-client/components/rooms/voting/scheduler/SchedulerMessageInput.vue';
	import EmojiPicker from '@hub-client/components/ui/EmojiPicker.vue';
	import Mention from '@hub-client/components/ui/Mention.vue';
	import MentionRoom from '@hub-client/components/ui/MentionRoom.vue';
	import Popover from '@hub-client/components/ui/Popover.vue';
	import PopoverButton from '@hub-client/components/ui/PopoverButton.vue';

	// Composables
	import { fileUpload } from '@hub-client/composables/fileUpload';
	import { useFormInputEvents, usedEvents } from '@hub-client/composables/useFormInputEvents';
	import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';

	// Logic
	import filters from '@hub-client/logic/core/filters';
	import { useMessageInput } from '@hub-client/logic/messageInput';

	// Models
	import { YiviSigningSessionResult } from '@hub-client/models/components/signedMessages';
	import { RelationType } from '@hub-client/models/constants';
	import { TMessageEvent } from '@hub-client/models/events/TMessageEvent';
	import { Poll, Scheduler } from '@hub-client/models/events/voting/VotingTypes';
	import Room from '@hub-client/models/rooms/Room';

	// Stores
	import { useMessageActions } from '@hub-client/stores/message-actions';
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { TPublicRoom, useRooms } from '@hub-client/stores/rooms';
	import { FeatureFlag, useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	const { t } = useI18n();
	const user = useUser();
	const route = useRoute();
	const rooms = useRooms();
	const pubhubs = usePubhubsStore();
	const settings = useSettings();
	const messageActions = useMessageActions();
	const messageInput = useMessageInput();

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
	const { allTypes, uploadUrl } = useMatrixFiles();

	// const fileInfo = ref<File>();
	const uri = ref<string>('');
	const pollObject = ref<Poll>(new Poll());
	const schedulerObject = ref<Scheduler>(new Scheduler());

	const caretPos = ref({ top: 0, left: 0 });

	const selectedAttributesSigningMessage = ref<string[]>(['pbdf.sidn-pbdf.email.email']);

	const filePickerEl = ref();
	const elTextInput = ref<InstanceType<typeof TextArea> | null>(null);
	const inReplyTo = ref<TMessageEvent | undefined>(undefined);

	let threadRoot: TMessageEvent | undefined = undefined;

	watch(route, () => {
		reset();
		messageInput.resetAll();
	});

	watch(
		value,
		() => {
			messageInput.state.sendButtonEnabled = isValidMessage();
		},
		{ immediate: true },
	);

	watch(
		() => props.room.roomId,
		async () => {
			inReplyTo.value = undefined;
			messageActions.replyingTo = undefined;

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
				pubhubs.editPoll(props.room.roomId, props.editingPoll.eventId, props.editingPoll.poll);
				pollObject.value = props.editingPoll.poll;
			}
		},
	);

	watch(
		() => props.editingScheduler,
		() => {
			if (props.editingScheduler) {
				pubhubs.editScheduler(props.room.roomId, props.editingScheduler.eventId, props.editingScheduler.scheduler);
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
			if (message?.content[RelationType.RelatesTo]?.[RelationType.RelType] === RelationType.Thread) {
				inReplyTo.value = props.inThread ? message : undefined;
			} else {
				inReplyTo.value = !props.inThread ? message : undefined;
			}
		}

		elTextInput.value?.$el.focus();
	});
	// function checkMessageContent(messagebody: string) {
	// 	if (messagebody && messagebody.includes('#')) {
	// 		const start = messagebody.indexOf('#') + 1; // Start after '#'
	// 		const end = messagebody.indexOf(' ', start); // Find the first space after '#'
	// 		const roomId = messagebody.substring(start, end === -1 ? messagebody.length : end);
	// 		rooms.fetchPublicRooms();
	// 		const room = rooms.getTPublicRoom(roomId);
	// 		return '#' + room?.name;
	// 	}
	// }

	// function afterRoomId(messagebody: string) {
	// 	if (messagebody && messagebody.includes('#')) {
	// 		const start = messagebody.indexOf('#') + 1;
	// 		const end = messagebody.indexOf(' ', start);
	// 		return messagebody.slice(end === -1 ? messagebody.length : end);
	// 	}
	// }
	// function beforeRoomId(messagebody: string) {
	// 	if (messagebody && messagebody.includes('#')) {
	// 		const start = messagebody.indexOf('#') + 1;
	// 		return messagebody.slice(0, start - 1);
	// 	}
	// }

	function clickedEmoticon(emoji: string) {
		value.value += emoji;
		elTextInput.value?.$el.focus();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!messageInput.hasActivePopup.value || event.key === 'Escape') {
			messageInput.resetAll();
			messageInput.state.sendButtonEnabled = isValidMessage();
		}
	}

	function isValidMessage(): boolean {
		let valid = false;
		// TextAreas always return strings, so the message is valid to send if it is a string with a length > 0
		if (typeof value.value === 'string' && value.value.trim().length > 0) valid = true;
		if ((messageInput.state.poll || messageInput.state.scheduler) && messageInput.state.sendButtonEnabled) valid = true;
		if (messageInput.state.fileAdded) valid = true;
		return valid;
	}

	function clickedAttachment() {
		if (filePickerEl.value) {
			filePickerEl.value.openFile();
		}
	}

	//  To autocomplete the mention user in the message.
	function mentionUser(user: any) {
		let userMention = user.rawDisplayName;

		// Make sure pseudonym is included if it hasn't
		if (!filters.extractPseudonymFromString(userMention)) {
			userMention += '~' + filters.extractPseudonym(user.userId);
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
	function mentionRoom(room: TPublicRoom) {
		let roomMention = room.room_id;

		let message = value.value?.toString();
		if (message?.lastIndexOf('#') !== -1) {
			const lastPosition = message?.lastIndexOf('#');
			message = message?.substring(0, lastPosition);
			value.value = message + ' #' + roomMention;
		} else {
			value.value += ' #' + roomMention;
		}
	}

	function submitMessage() {
		// This makes sure value.value is not undefined
		if (!messageInput.state.sendButtonEnabled || !isValidMessage()) return;

		if (messageInput.state.signMessage) {
			messageInput.state.showYiviQR = true;
			signMessage(value.value!.toString(), selectedAttributesSigningMessage.value, threadRoot);
		} else if (messageActions.replyingTo && inReplyTo.value) {
			pubhubs.addMessage(rooms.currentRoomId, value.value!.toString(), threadRoot, inReplyTo.value);
			messageActions.replyingTo = undefined;
			value.value = '';
		} else if (messageInput.state.poll) {
			sendPoll();
			value.value = '';
		} else if (messageInput.state.scheduler) {
			sendScheduler();
			value.value = '';
		} else if (messageInput.state.fileAdded) {
			messageInput.closeFileUpload();
			const syntheticEvent = {
				currentTarget: {
					files: [messageInput.state.fileAdded],
				},
			} as unknown as Event;
			fileUpload(t('errors.file_upload'), pubhubs.Auth.getAccessToken(), uploadUrl, allTypes, syntheticEvent, (url) => {
				pubhubs.addFile(rooms.currentRoomId, threadRoot?.event_id, messageInput.state.fileAdded as File, url, value.value as string);
				URL.revokeObjectURL(uri.value);
				value.value = '';
				messageInput.cancelFileUpload();
			});
		} else {
			pubhubs.submitMessage(value.value!.toString(), rooms.currentRoomId, threadRoot, inReplyTo.value);
			value.value = '';
		}
	}

	async function announcementMessage() {
		const powerLevel = props.room.getPowerLevel(user.userId);
		// if (value.value?.toLocaleString().length === 0) return;
		await pubhubs.addAnnouncementMessage(rooms.currentRoomId, value.value!.toString(), powerLevel);
		value.value = '';
	}

	function editMessage() {
		if (messageInput.state.poll && pollObject.value.canSend()) {
			pollObject.value.removeEmptyOptions();
			pubhubs.editPoll(rooms.currentRoomId, messageInput.state.editEventId as string, pollObject.value as Poll);
			messageInput.openTextArea();
		} else if (messageInput.state.scheduler && schedulerObject.value.canSend()) {
			pubhubs.editScheduler(rooms.currentRoomId, messageInput.state.editEventId as string, schedulerObject.value as Scheduler);
			messageInput.openTextArea();
		}
	}

	function signMessage(message: string, attributes: string[], threadRoot: TMessageEvent | undefined) {
		rooms.yiviSignMessage(message, attributes, rooms.currentRoomId, threadRoot, finishedSigningMessage);
	}

	function finishedSigningMessage(result: YiviSigningSessionResult, threadRoot: TMessageEvent | undefined) {
		pubhubs.addSignedMessage(rooms.currentRoomId, result, threadRoot);
		messageInput.state.showYiviQR = false;
		messageInput.state.signMessage = false;
		value.value = '';
	}

	const createScheduler = (scheduler: Scheduler, canSend: boolean) => {
		schedulerObject.value = scheduler;
		messageInput.state.sendButtonEnabled = canSend;
	};

	function sendScheduler() {
		pubhubs.addScheduler(rooms.currentRoomId, schedulerObject.value as Scheduler);
		messageInput.openTextArea();
	}

	const createPoll = (poll: Poll, canSend: boolean) => {
		pollObject.value = poll;
		messageInput.state.sendButtonEnabled = canSend;
	};

	function sendPoll() {
		pollObject.value.removeEmptyOptions();
		pubhubs.addPoll(rooms.currentRoomId, pollObject.value as Poll);
		messageInput.openTextArea();
	}

	function setCaretPos(pos: { top: number; left: number }) {
		caretPos.value = pos;
	}
</script>
