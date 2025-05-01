import { reactive } from 'vue';
import { Scheduler, Poll } from '@/model/events/voting/VotingTypes';

export const useMessageInputComposable = () => {
	const state = reactive({
		popover: false,
		sendButtonEnabled: false,
		textArea: true,
		showMention: true,
		emojiPicker: false,
		signMessage: false,
		showYiviQR: false,
		poll: false,
		pollObject: null as Poll | null,
		scheduler: false,
		schedulerObject: null as Scheduler | null,
		editEventId: undefined as string | undefined,
	});

	function togglePopover() {
		state.popover = !state.popover;
	}

	function isEdit() {
		return state.editEventId !== undefined;
	}

	function resetAll(rememberSendButtonEnabled = false) {
		state.popover = false;
		if (!rememberSendButtonEnabled) {
			state.sendButtonEnabled = false;
		}
		state.textArea = true;
		state.showMention = true;
		state.emojiPicker = false;
		state.signMessage = false;
		state.showYiviQR = false;
		state.poll = false;
		state.pollObject = null;
		state.scheduler = false;
		state.schedulerObject = null;
		state.editEventId = undefined;
	}

	function hasActivePopup() {
		return state.emojiPicker || state.showMention || state.popover || state.poll || state.scheduler;
	}

	function openTextArea() {
		resetAll();
	}

	function toggleEmojiPicker() {
		state.emojiPicker = !state.emojiPicker;
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

	return { state, togglePopover, isEdit, resetAll, hasActivePopup, openTextArea, toggleEmojiPicker, openSignMessage, openPoll, closePoll, editPoll, openScheduler, closeScheduler, editScheduler };
};
