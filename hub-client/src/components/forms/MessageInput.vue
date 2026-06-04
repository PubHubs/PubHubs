<template>
	<div
		class="w-full px-3 pb-3 md:px-6"
		v-bind="$attrs"
	>
		<!-- Timeout notification bar -->
		<TimeoutNotificationBar
			v-if="isCurrentUserTimedOut && currentUserTimeoutInfo"
			:timeout-until="currentUserTimeoutInfo.timeout_until"
			:reason="currentUserTimeoutInfo.reason"
			@timeout-expired="onTimeoutExpired"
		/>

		<!-- Yellow card notification bar -->
		<YellowCardNotificationBar
			v-if="isCurrentUserWarned && currentUserYellowCardInfo"
			:reason="currentUserYellowCardInfo.reason"
			@dismiss="onDismissYellowCard"
		/>

		<!-- Floating -->
		<div class="relative">
			<Popover
				v-if="messageInput.state.popover"
				class="absolute bottom-4"
				@close="messageInput.togglePopover()"
			>
				<div class="flex flex-wrap items-center gap-2">
					<PopoverButton
						icon="upload-simple"
						data-testid="upload"
						@click="clickedAttachment"
						>{{ $t('message.upload_file') }}</PopoverButton
					>
					<template v-if="settings.isFeatureEnabled(FeatureFlag.votingWidget) && !inThread && !inReplyTo">
						<PopoverButton
							icon="chart-bar"
							data-testid="poll"
							@click="messageInput.openPoll()"
							>{{ $t('message.poll') }}</PopoverButton
						>
						<PopoverButton
							icon="calendar"
							data-testid="scheduler"
							@click="messageInput.openScheduler()"
							>{{ $t('message.scheduler') }}</PopoverButton
						>
					</template>
					<PopoverButton
						v-if="!messageInput.state.signMessage && settings.isFeatureEnabled(FeatureFlag.signedMessages)"
						icon="seal-check"
						data-testid="sign"
						@click="messageInput.openSignMessage()"
						>{{ $t('message.sign.add_signature') }}</PopoverButton
					>
				</div>
			</Popover>
			<Popover
				v-if="moderationPopover"
				class="absolute right-0 bottom-4"
				@close="moderationPopover = false"
			>
				<div class="flex flex-wrap items-center justify-end gap-2">
					<PopoverButton
						v-if="roles.userHasPermissionForAction(UserAction.RoomAnnouncement, room.roomId) && !inThread && !room.isDirectMessageRoom()"
						icon="megaphone-simple"
						:class="isAnnouncementMode ? 'text-accent-steward' : ''"
						@click="
							isAnnouncementMode = !isAnnouncementMode;
							moderationPopover = false;
						"
						>{{ isAnnouncementMode ? $t('message.disable_announcement') : $t('message.enable_announcement') }}</PopoverButton
					>
				</div>
			</Popover>
			<MentionAutoComplete
				v-if="messageInput.state.showMention"
				:msg="value as string"
				:top="caretPos.top"
				:left="caretPos.left"
				:room="room"
				@click="(item, marker) => insertMention(item, marker)"
			/>
			<div
				v-if="messageInput.state.emojiPicker"
				class="xs:right-4 absolute right-0 bottom-2 z-20 md:right-12"
			>
				<EmojiPicker
					@emoji-selected="clickedEmoticon"
					@close="messageInput.toggleEmojiPicker()"
				/>
			</div>
		</div>

		<div class="flex max-h-[50vh] items-end justify-between gap-2">
			<div class="bg-surface-base rounded-base w-full shadow">
				<!-- In reply to -->
				<InputModeBar
					v-if="inReplyTo"
					icon="arrow-bend-up-left"
					:label="$t('message.in_reply_to')"
					variant="reply"
					@close="messageActions.replyingTo = undefined"
				>
					<Suspense>
						<MessageSnippet
							:event-id="messageActions.replyingTo ?? ''"
							:room="room"
						/>
						<template #fallback>
							<p class="text-on-surface-dim text-label-small">{{ $t('state.loading_message') }}</p>
						</template>
					</Suspense>
				</InputModeBar>

				<InputModeBar
					v-if="messageActions.whisperingToUserId"
					icon="whisper"
					:label="$t('menu.whisper')"
					:variant="announcementVariant"
					@close="clearWhisperMode()"
				>
					<Suspense v-if="messageActions.whisperingToEventId">
						<MessageSnippet
							:event-id="messageActions.whisperingToEventId"
							:room="room"
						/>
						<template #fallback>
							<p class="text-on-surface-dim text-label-small">{{ $t('state.loading_message') }}</p>
						</template>
					</Suspense>
				</InputModeBar>

				<FilePicker
					ref="filePickerEl"
					:message-input="messageInput"
					:upload-ownership-transferred="fileBlobOwnedByParent"
					@upload-file="handleFileUpload"
				></FilePicker>

				<template v-if="settings.isFeatureEnabled(FeatureFlag.votingWidget)">
					<PollMessageInput
						v-if="messageInput.state.poll"
						:poll-object="messageInput.state.pollObject as Poll"
						:is-edit="messageInput.isEdit.value"
						@create-poll="createPoll"
						@send-poll="submitMessage"
						@edit-poll="editMessage"
						@close-poll="messageInput.closePoll()"
					/>
					<SchedulerMessageInput
						v-if="messageInput.state.scheduler"
						:scheduler-object="messageInput.state.schedulerObject as Scheduler"
						:is-edit="messageInput.isEdit.value"
						@create-scheduler="createScheduler"
						@send-scheduler="submitMessage"
						@edit-scheduler="editMessage"
						@close-scheduler="messageInput.closeScheduler()"
					/>
				</template>

				<InputModeBar
					v-if="isAnnouncementMode"
					icon="megaphone-simple"
					:label="$t('message.announcement_mode')"
					:variant="announcementVariant"
					@close="isAnnouncementMode = false"
				/>

				<InputModeBar
					v-if="messageInput.state.signMessage"
					icon="seal-check"
					:label="$t('message.sign.signed_message_email')"
					:tooltip="$t('message.sign.signed_message_tooltip')"
					variant="sign"
					@close="messageInput.closeSignMessage()"
				/>

				<div
					v-if="messageInput.state.textArea"
					class="rounded-base border-surface-elevated flex items-center gap-x-4 border-3 px-4 py-2"
					:class="isInputDisabled ? 'cursor-not-allowed opacity-50' : ''"
				>
					<Icon
						v-if="isInputDisabled"
						type="plus-circle"
						size="lg"
						class="text-on-surface-dim cursor-not-allowed"
					/>
					<IconButton
						v-else
						:icon="messageInput.state.popover ? 'x-circle' : 'plus-circle'"
						data-testid="paperclip"
						size="base"
						variant="secondary"
						class="transition-transform duration-200 hover:cursor-pointer"
						:class="messageInput.state.popover ? 'rotate-90' : 'rotate-0'"
						@click.stop="
							messageInput.togglePopover();
							moderationPopover = false;
						"
					/>
					<!-- Overflow-x-hidden prevents firefox from adding an extra row to the textarea for a possible scrollbar -->
					<!-- Wrapper div captures Enter key to prevent submission when timed out -->
					<div
						class="grow"
						@keydown.enter.exact.capture="preventSubmitWhenTimedOut"
					>
						<MessageInputTextArea
							ref="elTextInput"
							v-model="valueAsString"
							class="text-label placeholder:text-on-surface-variant max-h-40 overflow-x-hidden border-none bg-transparent md:max-h-60"
							:class="isInputDisabled ? 'cursor-not-allowed' : ''"
							:placeholder="inputPlaceholder"
							:title="$t('rooms.new_message')"
							:disabled="isInputDisabled"
							@changed="changed()"
							@submit="submitMessage()"
							@cancel="cancel()"
							@caret-pos="setCaretPos"
							@focus="messageInput.state.showMention = true"
							@blur="
								setTimeout(() => {
									messageInput.state.showMention = false;
								}, 150)
							"
							@paste="handlePaste"
						/>
					</div>

					<!--Moderation tools-->
					<button
						v-if="roles.userHasPermissionForAction(UserAction.RoomAnnouncement, room.roomId) && !inThread && !room.isDirectMessageRoom()"
						class="hover:cursor-pointer"
						:class="moderationPopover ? 'text-accent-steward' : ''"
						:title="$t('menu.moderation')"
						@click.stop="
							moderationPopover = !moderationPopover;
							messageInput.state.popover = false;
						"
					>
						<Icon type="circles-three-plus"></Icon>
					</button>

					<!-- Emoji picker -->
					<button :class="isInputDisabled ? 'opacity-50 hover:cursor-not-allowed' : 'hover:cursor-pointer'">
						<Icon
							type="smiley"
							@click.stop="toggleEmojiPicker()"
						/>
					</button>

					<!-- Sendbutton -->
					<button
						:title="$t('message.send')"
						:class="!messageInput.state.sendButtonEnabled ? 'opacity-50 hover:cursor-not-allowed' : 'hover:cursor-pointer'"
						:disabled="!messageInput.state.sendButtonEnabled"
						@click="submitMessage"
					>
						<Icon type="paper-plane-right" />
					</button>
				</div>
			</div>
		</div>
	</div>

	<!-- Yivi signing dialog -->
	<Teleport to="body">
		<Dialog
			v-if="messageInput.state.showYiviQR"
			:title="$t('message.sign.heading')"
			:buttons="signingDialogButtons"
			@close="messageInput.state.showYiviQR = false"
		>
			<div
				:id="EYiviFlow.Sign"
				ref="yivi-login-ref"
			></div>
		</Dialog>
	</Teleport>
</template>

<script setup lang="ts">
	// Packages
	import { setTimeout } from 'node:timers';
	import { type PropType, computed, nextTick, onBeforeUnmount, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { useRoute } from 'vue-router';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import IconButton from '@hub-client/components/elements/IconButton.vue';
	import MessageInputTextArea from '@hub-client/components/forms/MessageInputTextArea.vue';
	import type TextAreaOld from '@hub-client/components/forms/elements/TextAreaOld.vue';
	import MessageSnippet from '@hub-client/components/rooms/MessageSnippet.vue';
	import PollMessageInput from '@hub-client/components/rooms/voting/poll/PollMessageInput.vue';
	import SchedulerMessageInput from '@hub-client/components/rooms/voting/scheduler/SchedulerMessageInput.vue';
	import Dialog from '@hub-client/components/ui/Dialog.vue';
	import EmojiPicker from '@hub-client/components/ui/EmojiPicker.vue';
	import FilePicker from '@hub-client/components/ui/FilePicker.vue';
	import InputModeBar from '@hub-client/components/ui/InputModeBar.vue';
	import MentionAutoComplete from '@hub-client/components/ui/MentionAutoComplete.vue';
	import Popover from '@hub-client/components/ui/Popover.vue';
	import PopoverButton from '@hub-client/components/ui/PopoverButton.vue';
	import TimeoutNotificationBar from '@hub-client/components/ui/TimeoutNotificationBar.vue';
	import YellowCardNotificationBar from '@hub-client/components/ui/YellowCardNotificationBar.vue';

	// Composables
	import { fileUpload } from '@hub-client/composables/fileUpload';
	import { type UserDetails } from '@hub-client/composables/mention-autocomplete.composable';
	import { useModerationBase } from '@hub-client/composables/moderation/base.composable';
	import { useModerationTimeout } from '@hub-client/composables/moderation/timeout.composable';
	import { useModerationYellowCard } from '@hub-client/composables/moderation/yellow-card.composable';
	import { useRoles } from '@hub-client/composables/roles.composable';
	import { useFormInputEvents, usedEvents } from '@hub-client/composables/useFormInputEvents';
	import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';
	import { useYiviIosWorkaround } from '@hub-client/composables/yiviIosWorkaround.composable';

	// Logic
	import { BlobManager } from '@hub-client/logic/core/blobManager';
	import { useMessageInput } from '@hub-client/logic/messageInput';
	import { yiviFlow } from '@hub-client/logic/yiviHandler';

	// Models
	import { type YiviSigningSessionResult } from '@hub-client/models/components/signedMessages';
	import { RelationType } from '@hub-client/models/constants';
	import { type TMessageEvent } from '@hub-client/models/events/TMessageEvent';
	import { Poll, Scheduler } from '@hub-client/models/events/voting/VotingTypes';
	import Room from '@hub-client/models/rooms/Room';
	import { UserAction } from '@hub-client/models/users/TUser';
	import { EYiviFlow, type SecuredRoomAttributeResult } from '@hub-client/models/yivi/Tyivi';

	// Stores
	import { buttonsCancel } from '@hub-client/stores/dialog';
	import { useMessageActions } from '@hub-client/stores/message-actions';
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { type TPublicRoom, useRooms } from '@hub-client/stores/rooms';
	import { FeatureFlag, useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

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

	defineOptions({ inheritAttrs: false });

	const { t } = useI18n();
	const user = useUser();
	const route = useRoute();
	const roles = useRoles();
	const rooms = useRooms();
	const pubhubs = usePubhubsStore();
	const settings = useSettings();
	const messageActions = useMessageActions();
	const messageInput = useMessageInput();
	const base = useModerationBase();
	const { isCurrentUserTimedOut, currentUserTimeoutInfo, refreshTimeoutStatus } = useModerationTimeout(base);
	const { isCurrentUserWarned, currentUserYellowCardInfo, dismissYellowCard } = useModerationYellowCard(base);

	const { value, reset, changed, cancel } = useFormInputEvents(emit);
	const valueAsString = computed({
		get: () => (value.value as string) ?? '',
		set: (v: string) => {
			value.value = v;
		},
	});
	const { allTypes, uploadUrl } = useMatrixFiles();

	const pollObject = ref<Poll>(new Poll());
	const schedulerObject = ref<Scheduler>(new Scheduler());
	const uriForFileUpload = ref<BlobManager>();
	const fileBlobOwnedByParent = ref(false);

	const caretPos = ref({ top: 0, left: 0 });

	const selectedAttributesSigningMessage = ref<string[]>(['pbdf.sidn-pbdf.email.email']);

	const filePickerEl = ref();
	const elTextInput = ref<InstanceType<typeof TextAreaOld> | null>(null);
	const inReplyTo = ref<TMessageEvent | undefined>(undefined);
	const isAnnouncementMode = ref(false);
	const moderationPopover = ref(false);

	const announcementVariant = computed(() => 'steward' as const);

	const isInputDisabled = computed(() => isCurrentUserTimedOut.value || isCurrentUserWarned.value);

	const inputPlaceholder = computed(() => {
		if (isCurrentUserTimedOut.value) {
			return t('moderation.placeholder_timed_out');
		}
		if (isCurrentUserWarned.value) {
			return t('moderation.placeholder_warning');
		}
		if (isAnnouncementMode.value) {
			return t('message.announcement_placeholder');
		}
		return t('rooms.new_message');
	});

	let threadRoot: TMessageEvent | undefined = undefined;

	const signingDialogButtons = buttonsCancel;

	watch(route, () => {
		revokeOwnedFileUploadBlob();
		reset();
		messageInput.resetAll();
		clearWhisperMode();
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
			revokeOwnedFileUploadBlob();
			inReplyTo.value = undefined;
			messageActions.replyingTo = undefined;
			clearWhisperMode();

			if (props.room.getCurrentThreadId()) {
				threadRoot = (await pubhubs.getEvent(props.room.roomId, props.room.getCurrentThreadId() as string)) as TMessageEvent;
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
					threadRoot = (await pubhubs.getEvent(props.room.roomId, props.room.getCurrentThreadId() as string)) as TMessageEvent;
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
				messageInput.editPoll(props.editingPoll.poll, props.editingPoll.eventId);
			}
		},
	);

	watch(
		() => props.editingScheduler,
		() => {
			if (props.editingScheduler) {
				messageInput.editScheduler(props.editingScheduler.scheduler, props.editingScheduler.eventId);
			}
		},
	);

	onMounted(async () => {
		globalThis.addEventListener('keydown', handleKeydown);
		reset();
	});

	function revokeOwnedFileUploadBlob() {
		if (fileBlobOwnedByParent.value) {
			uriForFileUpload.value?.revoke();
		}
		fileBlobOwnedByParent.value = false;
		uriForFileUpload.value = undefined;
	}

	onBeforeUnmount(() => {
		revokeOwnedFileUploadBlob();
	});

	onUnmounted(() => {
		globalThis.removeEventListener('keydown', handleKeydown);
	});

	// Focus on message input if the state of messageActions changes (for example, when replying).
	messageActions.$subscribe(async () => {
		inReplyTo.value = undefined;

		// If we are replying to a message, we need to check if the message is a thread or not
		// if the message is in a thread we can only set inReplyTo if we are in a thread
		// if the message is not in a thread we can only set inReplyTo if we are not in a thread
		if (messageActions.replyingTo) {
			const message = ((await pubhubs.getEvent(props.room.roomId, messageActions.replyingTo)) as TMessageEvent) ?? undefined;
			if (message?.content[RelationType.RelatesTo]?.[RelationType.RelType] === RelationType.Thread) {
				inReplyTo.value = props.inThread ? message : undefined;
			} else {
				inReplyTo.value = props.inThread ? undefined : message;
			}
		}

		messageInput.state.sendButtonEnabled = isValidMessage();
		elTextInput.value?.$el.focus();
	});

	function clickedEmoticon(emoji: string) {
		value.value += emoji;
		elTextInput.value?.$el.focus();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (messageInput.state.signMessage || messageInput.state.showYiviQR) return;
		if (!messageInput.hasActivePopup.value || event.key === 'Escape') {
			messageInput.resetAll();
			messageInput.state.sendButtonEnabled = isValidMessage();
		}
	}

	function isUserCurrentlyTimedOut(): boolean {
		const timeoutInfo = currentUserTimeoutInfo.value;
		return !!timeoutInfo && timeoutInfo.timeout_until > Date.now();
	}

	function isValidMessage(): boolean {
		// Cannot send if timed out - check actual timestamp, not cached computed
		if (isUserCurrentlyTimedOut()) return false;

		let valid = false;
		// TextAreas always return strings, so the message is valid to send if it is a string with a length > 0
		if (typeof value.value === 'string' && value.value.trim().length > 0) valid = true;
		if ((messageInput.state.poll || messageInput.state.scheduler) && messageInput.state.sendButtonEnabled) valid = true;
		if (messageInput.state.fileAdded) valid = true;
		return valid;
	}

	function onTimeoutExpired() {
		// Force re-computation of timeout-related computed properties
		refreshTimeoutStatus();
		// Re-check send button state when timeout expires
		messageInput.state.sendButtonEnabled = isValidMessage();
	}

	async function onDismissYellowCard() {
		await dismissYellowCard(props.room.roomId);
	}

	function preventSubmitWhenTimedOut(event: KeyboardEvent) {
		// Prevent Enter key from triggering submit when user is timed out
		// This stops the event before it reaches the TextArea's internal handler
		if (isUserCurrentlyTimedOut()) {
			event.stopPropagation();
		}
	}

	function clickedAttachment() {
		if (filePickerEl.value) {
			filePickerEl.value.openFile();
		}
	}

	function handlePaste(event: ClipboardEvent) {
		const items = event.clipboardData?.items;
		if (!items) return;
		for (const item of items) {
			if (!item.type.startsWith('image/')) continue;
			event.preventDefault();
			const file = item.getAsFile();
			if (!file) continue;
			if (fileBlobOwnedByParent.value && uriForFileUpload.value) {
				uriForFileUpload.value.revoke();
			}
			messageInput.setFileAdded(file);
			const blobManager = new BlobManager(file);
			uriForFileUpload.value = blobManager;
			fileBlobOwnedByParent.value = true;
			messageInput.activateSendButton();
			return;
		}
	}

	function handleFileUpload(uriBlob: BlobManager | undefined) {
		if (fileBlobOwnedByParent.value && uriForFileUpload.value && uriForFileUpload.value !== uriBlob) {
			uriForFileUpload.value.revoke();
		}
		uriForFileUpload.value = uriBlob;
		fileBlobOwnedByParent.value = !!uriBlob;
		if (!uriBlob) {
			messageInput.state.sendButtonEnabled = isValidMessage();
		}
	}

	function insertMention(item: UserDetails | TPublicRoom, marker: '@' | '#') {
		const isUserMention = marker === '@';
		const displayName = isUserMention ? (item as UserDetails).displayName : (item as TPublicRoom).name;
		const id = isUserMention ? (item as UserDetails).userId : (item as TPublicRoom).room_id;

		const mention = `${marker}${displayName}~${id}~`;

		let message = value.value?.toString();
		const lastPosition = message?.lastIndexOf(marker);

		if (lastPosition === -1) {
			value.value += mention;
		} else {
			message = message?.substring(0, lastPosition);
			value.value = message + mention;
		}

		elTextInput.value?.$el.focus();
	}

	async function submitMessage() {
		// Don't process submission if user is timed out - keep their message intact
		if (isUserCurrentlyTimedOut()) return;

		// This makes sure value.value is not undefined
		if (!messageInput.state.sendButtonEnabled || !isValidMessage()) return;

		if (messageInput.state.signMessage) {
			messageInput.state.showYiviQR = true;
			await nextTick();
			signMessage(String(value.value), selectedAttributesSigningMessage.value, threadRoot);
		} else if (isAnnouncementMode.value) {
			// Send as announcement
			const powerLevel = props.room.getPowerLevel(user.userId ?? '');
			await pubhubs.addAnnouncementMessage(props.room.roomId, String(value.value), powerLevel);
			value.value = '';
			isAnnouncementMode.value = false;
		} else if (messageActions.whisperingToUserId) {
			const powerLevel = props.room.getPowerLevel(user.userId ?? '');
			let whisperReplyEvent: TMessageEvent | undefined = undefined;
			if (messageActions.whisperingToEventId) {
				whisperReplyEvent = ((await pubhubs.getEvent(props.room.roomId, messageActions.whisperingToEventId)) as TMessageEvent) ?? undefined;
			}
			await pubhubs.addWhisperMessage(
				props.room.roomId,
				String(value.value),
				powerLevel,
				messageActions.whisperingToUserId,
				threadRoot,
				whisperReplyEvent,
			);
			clearWhisperMode();
			value.value = '';
		} else if (messageInput.state.poll) {
			sendPoll();
			value.value = '';
		} else if (messageInput.state.scheduler) {
			sendScheduler();
			value.value = '';
		} else if (messageInput.state.fileAdded) {
			// `fileAdded` is the actual payload to upload.
			// `uriForFileUpload` is only the local preview blob URL manager.
			const replyTo = inReplyTo.value;
			if (replyTo) messageActions.replyingTo = undefined;
			messageInput.closeFileUpload();
			const syntheticEvent = {
				currentTarget: {
					files: [messageInput.state.fileAdded],
				},
			} as unknown as Event;
			const accessToken = pubhubs.Auth.getAccessToken();
			if (!accessToken) return;
			fileUpload(t('errors.file_upload'), accessToken, uploadUrl, allTypes, syntheticEvent, (url) => {
				pubhubs.addFile(
					props.room.roomId,
					threadRoot?.event_id,
					undefined,
					messageInput.state.fileAdded as File,
					url,
					value.value as string,
					undefined,
					replyTo,
				);
				uriForFileUpload.value?.revoke();
				fileBlobOwnedByParent.value = false;
				uriForFileUpload.value = undefined;
				value.value = '';
				messageInput.cancelFileUpload();
				messageInput.state.sendButtonEnabled = isValidMessage();
			});
		} else if (messageActions.replyingTo && inReplyTo.value) {
			pubhubs.addMessage(props.room.roomId, String(value.value), threadRoot, inReplyTo.value);
			messageActions.replyingTo = undefined;
			value.value = '';
		} else {
			pubhubs.submitMessage(String(value.value), props.room.roomId, threadRoot, inReplyTo.value);
			value.value = '';
		}
	}

	function editMessage() {
		if (messageInput.state.poll && messageInput.state.pollObject?.canSend()) {
			messageInput.state.pollObject.removeEmptyOptions();
			pubhubs.editPoll(props.room.roomId, messageInput.state.editEventId as string, messageInput.state.pollObject as Poll);
			messageInput.openTextArea();
		} else if (messageInput.state.scheduler && messageInput.state.schedulerObject?.canSend()) {
			pubhubs.editScheduler(props.room.roomId, messageInput.state.editEventId as string, messageInput.state.schedulerObject as Scheduler);
			messageInput.openTextArea();
		}
	}

	function signMessage(message: string, attributes: string[], threadRoot: TMessageEvent | undefined) {
		yiviFlow(EYiviFlow.Sign, finishedSigningMessage, rooms.currentRoomId, '#' + EYiviFlow.Sign, attributes, message, threadRoot);
	}

	function toggleEmojiPicker() {
		if (isInputDisabled.value) return;
		messageInput.toggleEmojiPicker();
	}

	function finishedSigningMessage(result: YiviSigningSessionResult | SecuredRoomAttributeResult, threadRoot: TMessageEvent | undefined) {
		pubhubs.addSignedMessage(props.room.roomId, result as YiviSigningSessionResult, threadRoot);
		messageInput.state.showYiviQR = false;
		messageInput.state.signMessage = false;
		value.value = '';
	}

	const createScheduler = (scheduler: Scheduler, canSend: boolean) => {
		schedulerObject.value = scheduler;
		messageInput.state.sendButtonEnabled = canSend;
	};

	function sendScheduler() {
		pubhubs.addScheduler(props.room.roomId, schedulerObject.value as Scheduler);
		messageInput.openTextArea();
	}

	const createPoll = (poll: Poll, canSend: boolean) => {
		pollObject.value = poll;
		messageInput.state.sendButtonEnabled = canSend;
	};

	function sendPoll() {
		pollObject.value.removeEmptyOptions();
		pubhubs.addPoll(props.room.roomId, pollObject.value as Poll);
		messageInput.openTextArea();
	}

	function setCaretPos(pos: { top: number; left: number }) {
		caretPos.value = pos;
	}

	function clearWhisperMode() {
		messageActions.whisperingToUserId = undefined;
		messageActions.whisperingToDisplayName = undefined;
		messageActions.whisperingToEventId = undefined;
	}

	// START workaround for #1173, that iOS app links do not work in an iframe.
	const yiviLoginRef = useTemplateRef('yivi-login-ref');
	useYiviIosWorkaround(yiviLoginRef);
	// END workaround
</script>
