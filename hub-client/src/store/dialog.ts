import { defineStore } from 'pinia';
import { MessageType, Message, useMessageBox } from './messagebox';
import { setUpi18n } from '../i18n';

/**
 * Global Dialog, uses components/ui/Dialog.vue component which is globally present in App.vue
 */

/**
 * DialogButton class with:
 * - label
 * - color
 * - action (return value)
 */

type DialogButtonAction = string | number;
const DialogFalse = 0;
const DialogTrue = 1;

class DialogButton {
	label: string;
	color: string;
	action: DialogButtonAction;

	constructor(label = '', color = '', action = DialogFalse) {
		this.label = label;
		this.color = color;
		this.action = action;
	}
}

const buttonsOk: Array<DialogButton> = [new DialogButton('ok', 'blue', DialogTrue)];

const buttonsOkCancel: Array<DialogButton> = [new DialogButton('ok', 'blue', DialogTrue), new DialogButton('cancel', 'red', DialogFalse)];

const buttonsSubmitCancel: Array<DialogButton> = [new DialogButton('submit', 'blue', DialogTrue), new DialogButton('cancel', 'red', DialogFalse)];

const buttonsYesNo: Array<DialogButton> = [new DialogButton('yes', 'blue', DialogTrue), new DialogButton('no', 'red', DialogFalse)];

/**
 * DailogProperties class with all the properties a dialog needs
 */
class DialogProperties {
	title: string;
	content: string;
	buttons: Array<DialogButton>;
	modal: Boolean;
	modalonly: Boolean;
	close: Boolean;

	constructor(title = '', content = '', buttons: Array<DialogButton> = [], modal = true, close = true) {
		this.title = title;
		this.content = content;
		if (buttons.length == 0) {
			this.buttons = buttonsOkCancel;
		} else {
			this.buttons = buttons;
		}
		this.modal = modal;
		this.modalonly = false;
		this.close = close;
	}
}

/**
 * The main dialog store
 */
const useDialog = defineStore('dialog', {
	state: () => {
		return {
			global: false as Boolean,
			visible: false as Boolean,
			properties: new DialogProperties(),
			resolveDialog: {} as Function,
			callbacks: {} as { [index: DialogButtonAction]: Function },
		};
	},

	getters: {},

	actions: {
		asGlobal(global = true) {
			this.global = global;
		},

		/**
		 * Call this to show a generic dialog with the given properties.
		 *
		 * @param properties DialogProperties
		 * @returns Promise with the answer of the pressed button
		 */
		show(properties: DialogProperties | null = null) {
			if (window.self !== window.top) {
				const messagebox = useMessageBox();
				messagebox.sendMessage(new Message(MessageType.DialogShowModal));
			}
			return new Promise((resolve) => {
				if (properties === null) {
					this.properties = new DialogProperties();
				} else {
					this.properties = properties;
				}
				this.visible = true;
				this.resolveDialog = resolve;
			});
		},

		/**
		 * Closes and hides the dialog and retuns the answer
		 *
		 * @param returnValue the answer that will be given back
		 */
		close(returnValue: DialogButtonAction) {
			if (window.self !== window.top) {
				const messagebox = useMessageBox();
				messagebox.sendMessage(new Message(MessageType.DialogHideModal));
			}
			this.visible = false;
			const callback = this.callbacks[returnValue];
			if (callback) {
				callback(returnValue);
			}
			if (typeof this.resolveDialog === 'function') {
				this.resolveDialog(returnValue);
			}
		},

		/**
		 * Shows a simple confirm dialog, with an error prefix, with only an 'Ok' button.
		 *
		 * @param title Text in the header of the dialog (prefixed by an error)
		 * @param content @default[''] Text in the main area of the dialog
		 * @returns
		 */
		showError(title: string, content: string = '') {
			const i18n = setUpi18n();
			const { t } = i18n.global;
			const message = t('errors.error', title);
			return this.show(new DialogProperties(message, content, buttonsOk));
		},

		/**
		 * Shows a simple confirm dialog with only an 'Ok' button.
		 *
		 * @param title Text in the header of the dialog
		 * @param content @default[''] Text in the main area of the dialog
		 * @returns
		 */
		confirm(title: string, content: string = '') {
			return this.show(new DialogProperties(title, content, buttonsOk));
		},

		/**
		 * Shows a simple confirm dialog with only the 'Ok' and 'Cancel' buttons.
		 *
		 * @param title Text in the header of the dialog
		 * @param content @default[''] Text in the main area of the dialog
		 * @returns
		 */
		okcancel(title: string, content: string = '') {
			return this.show(new DialogProperties(title, content, buttonsOkCancel));
		},

		/**
		 * Shows a simple confirm dialog with only the 'Yes' and 'No' buttons.
		 *
		 * @param title Text in the header of the dialog
		 * @param content @default[''] Text in the main area of the dialog
		 * @returns
		 */
		yesno(title: string, content: string = '') {
			return this.show(new DialogProperties(title, content, buttonsYesNo));
		},

		addCallback(action: DialogButtonAction, callback: Function) {
			this.callbacks[action] = callback;
		},

		removeCallback(action: DialogButtonAction) {
			delete this.callbacks[action];
		},
	},
});

export { buttonsSubmitCancel, DialogButton, type DialogButtonAction, DialogFalse, DialogTrue, DialogProperties, useDialog };
