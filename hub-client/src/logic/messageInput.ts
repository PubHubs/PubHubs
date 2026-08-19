// Packages
import { computed, reactive } from 'vue';

// Models
import { type FileInfo } from '@hub-client/models/events/FileInfo';
import { type Poll, type Scheduler } from '@hub-client/models/events/voting/VotingTypes';

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
		editingExistingFile: null as FileInfo | null,
		sharedFile: null as FileInfo | null,
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
		state.editingExistingFile = null;
		state.sharedFile = null;
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

	function setFileAdded(file: File | null) {
		state.fileAdded = file;
		// A freshly picked file replaces a file that was shared from the library.
		if (file) state.sharedFile = null;
	}

	function cancelFileUpload() {
		state.fileDialog = false;
		state.fileAdded = null;
	}

	function closeFileUpload() {
		state.fileDialog = false;
	}

	/**
	 * Attaches a file that is already on the media server (shared from the room library),
	 * so it can be sent with a caption without being uploaded again.
	 */
	function attachSharedFile(file: FileInfo) {
		resetAll();
		state.sharedFile = file;
		state.sendButtonEnabled = true;
	}

	function removeSharedFile() {
		state.sharedFile = null;
	}

	function openSignMessage() {
		const savedFile = state.fileAdded;
		resetAll(true);
		state.fileAdded = savedFile;
		state.signMessage = true;
	}

	function closeSignMessage() {
		state.signMessage = false;
		state.showYiviQR = false;
	}

	function openPoll() {
		resetAll();
		state.textArea = false;
		state.poll = true;
	}

	function closePoll() {
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

	function editMessage(editEventId: string, existingFile?: FileInfo) {
		resetAll();
		state.editEventId = editEventId;
		state.textArea = true;
		state.editingExistingFile = existingFile ?? null;
	}

	function removeExistingFile() {
		state.editingExistingFile = null;
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
		setFileAdded,
		toggleEmojiPicker,
		openFileDialog,
		cancelFileUpload,
		closeFileUpload,
		attachSharedFile,
		removeSharedFile,
		openSignMessage,
		closeSignMessage,
		openPoll,
		closePoll,
		editPoll,
		editMessage,
		removeExistingFile,
		openScheduler,
		closeScheduler,
		editScheduler,
	};
}

export { useMessageInput };
