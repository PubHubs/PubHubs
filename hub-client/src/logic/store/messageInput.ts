import { computed, reactive } from 'vue';
import { Scheduler, Poll } from '@/model/events/voting/VotingTypes.js';

// This is used on multiple messageinputs at the same time, so we need to create a new instance of it for each message input.
// That's why it is a composable and not a store.

function useMessageInput() {
	const state = reactive({
		popover: false,
		sendButtonEnabled: false,
		textArea: true,
		showMention: true,
		emojiPicker: false,
		signMessage: false,
		showYiviQR: false,
		fileDialog: false,
		fileAdded: null as File | null,
		poll: false,
		pollObject: null as Poll | null,
		scheduler: false,
		schedulerObject: null as Scheduler | null,
		editEventId: undefined as string | undefined,
	});

	const isEdit = computed(() => state.editEventId !== undefined);
	const hasActivePopup = computed(() => state.emojiPicker || state.showMention || state.popover || state.poll || state.scheduler);

	function resetAll(rememberSendButtonEnabled = false) {
		state.popover = false;
		if (!rememberSendButtonEnabled) state.sendButtonEnabled = false;
		state.textArea = true;
		state.showMention = true;
		state.emojiPicker = false;
		state.signMessage = false;
		state.showYiviQR = false;
		state.fileDialog = false;
		state.fileAdded = null;
		state.poll = false;
		state.pollObject = null;
		state.scheduler = false;
		state.schedulerObject = null;
		state.editEventId = undefined;
	}

	function togglePopover() {
		state.popover = !state.popover;
	}

	function openTextArea() {
		resetAll();
	}

	function activateSendButton() {
		state.sendButtonEnabled = true;
	}

	function toggleEmojiPicker() {
		state.emojiPicker = !state.emojiPicker;
	}

	function openFileDialog() {
		state.fileDialog = true;
		state.fileAdded = null;
	}

	function cancelFileUpload() {
		state.fileDialog = false;
		state.fileAdded = null;
	}

	function closeFileUpload() {
		state.fileDialog = false;
	}

	function openSignMessage() {
		resetAll(true);
		state.signMessage = true;
	}

	function openPoll() {
		resetAll();
		state.textArea = false;
		state.poll = true;
	}

	function closePoll() {
		console.error('closePoll called');
		resetAll();
	}

	function editPoll(pollObject: Poll, editEventId: string) {
		resetAll();
		state.poll = true;
		state.pollObject = pollObject;
		state.pollObject.addNewOptionsIfAllFilled();
		state.editEventId = editEventId;
		state.textArea = false;
	}

	function openScheduler() {
		resetAll();
		state.textArea = false;
		state.scheduler = true;
	}

	function closeScheduler() {
		resetAll();
	}

	function editScheduler(schedulerObject: Scheduler, editEventId: string) {
		resetAll();
		state.scheduler = true;
		state.schedulerObject = schedulerObject;
		state.schedulerObject.addNewOptionsIfAllFilled();
		state.editEventId = editEventId;
		state.textArea = false;
	}

	return {
		state,
		isEdit,
		hasActivePopup,
		resetAll,
		togglePopover,
		openTextArea,
		activateSendButton,
		toggleEmojiPicker,
		openFileDialog,
		cancelFileUpload,
		closeFileUpload,
		openSignMessage,
		openPoll,
		closePoll,
		editPoll,
		openScheduler,
		closeScheduler,
		editScheduler,
	};
}

export { useMessageInput };
