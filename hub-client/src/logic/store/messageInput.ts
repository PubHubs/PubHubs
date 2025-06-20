import { defineStore } from 'pinia';

import { Scheduler, Poll } from '@/model/events/voting/VotingTypes';

const useMessageInput = defineStore('messageInput', {
	state: () => {
		return {
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
		};
	},

	getters: {
		isEdit(state): Boolean {
			return state.editEventId !== undefined;
		},

		hasActivePopup(state): Boolean {
			return state.emojiPicker || state.showMention || state.popover || state.poll || state.scheduler;
		},
	},

	actions: {
		resetAll(rememberSendButtonEnabled = false) {
			this.popover = false;
			if (!rememberSendButtonEnabled) {
				this.sendButtonEnabled = false;
			}
			this.textArea = true;
			this.showMention = true;
			this.emojiPicker = false;
			this.signMessage = false;
			this.showYiviQR = false;
			this.fileDialog = false;
			this.fileAdded = null;
			this.poll = false;
			this.pollObject = null;
			this.scheduler = false;
			this.schedulerObject = null;
			this.editEventId = undefined;
		},

		togglePopover() {
			this.popover = !this.popover;
		},

		openTextArea() {
			this.resetAll();
		},

		activateSendButton() {
			this.sendButtonEnabled = true;
		},

		toggleEmojiPicker() {
			this.emojiPicker = !this.emojiPicker;
		},

		openFileDialag() {
			this.fileDialog = true;
			this.fileAdded = null;
		},

		cancelFileUpload() {
			this.fileDialog = false;
			this.fileAdded = null;
		},

		closeFileUpload() {
			this.fileDialog = false;
		},

		openSignMessage() {
			this.resetAll(true);
			this.signMessage = true;
		},

		openPoll() {
			this.resetAll();
			this.textArea = false;
			this.poll = true;
		},

		closePoll() {
			this.resetAll();
		},

		editPoll(pollObject: Poll, editEventId: string) {
			this.resetAll();
			this.poll = true;
			this.pollObject = pollObject;
			this.pollObject.addNewOptionsIfAllFilled();
			this.editEventId = editEventId;
			this.textArea = false;
		},

		openScheduler() {
			this.resetAll();
			this.textArea = false;
			this.scheduler = true;
		},

		closeScheduler() {
			this.resetAll();
		},

		editScheduler(schedulerObject: Scheduler, editEventId: string) {
			this.resetAll();
			this.scheduler = true;
			this.schedulerObject = schedulerObject;
			this.schedulerObject.addNewOptionsIfAllFilled();
			this.editEventId = editEventId;
			this.textArea = false;
		},
	},
});

export {
	useMessageInput,
	//     state,
	//     togglePopover,
	//     isEdit,
	//     resetAll,
	//     hasActivePopup,
	//     activateSendButton,
	//     openTextArea,
	//     toggleEmojiPicker,
	//     openSignMessage,
	//     openFileDialag,
	//     cancelFileUpload,
	//     closeFileUpload,
	//     openPoll,
	//     closePoll,
	//     editPoll,
	//     openScheduler,
	//     closeScheduler,
	//     editScheduler,
	// };
};
