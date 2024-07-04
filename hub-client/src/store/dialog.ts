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
const DialogCancel = 0;
const DialogNo = 0;
const DialogOk = 1;
const DialogYes = 1;
const DialogSubmit = 1;

class DialogButton {
	label: string;
	color: string;
	enabled: boolean;
	action: DialogButtonAction;

	constructor(label = '', color = '', action = DialogCancel) {
		this.label = label;
		this.color = color;
		this.action = action;
		this.enabled = true;
	}
}

const buttonsOk: Array<DialogButton> = [new DialogButton('ok', 'blue', DialogOk)];

const buttonsCancel: Array<DialogButton> = [new DialogButton('cancel', 'red', DialogCancel)];

const buttonsOkCancel: Array<DialogButton> = [new DialogButton('ok', 'blue', DialogOk), new DialogButton('cancel', 'red', DialogCancel)];

const buttonsSubmitCancel: Array<DialogButton> = [new DialogButton('submit', 'blue', DialogSubmit), new DialogButton('cancel', 'red', DialogCancel)];

const buttonsYesNo: Array<DialogButton> = [new DialogButton('yes', 'blue', DialogYes), new DialogButton('no', 'red', DialogNo)];

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
		if (buttons.length === 0) {
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
			this.showModal();
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
			this.hideModal();
			this.visible = false;
			const callback = this.callbacks[returnValue];
			if (callback) {
				callback(returnValue);
			}
			if (typeof this.resolveDialog === 'function') {
				this.resolveDialog(returnValue);
			}
			// reset
			this.properties = new DialogProperties();
		},

		showModal() {
			if (window.self !== window.top) {
				const messagebox = useMessageBox();
				messagebox.sendMessage(new Message(MessageType.DialogShowModal));
			}
		},

		hideModal() {
			if (window.self !== window.top) {
				const messagebox = useMessageBox();
				messagebox.sendMessage(new Message(MessageType.DialogHideModal));
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

		disableButton(nr: number) {
			this.properties.buttons[nr].enabled = false;
		},

		enableButton(nr: number) {
			this.properties.buttons[nr].enabled = true;
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

export { buttonsOk, buttonsCancel, buttonsSubmitCancel, buttonsOkCancel, DialogButton, type DialogButtonAction, DialogCancel, DialogOk, DialogYes, DialogNo, DialogSubmit, DialogProperties, useDialog };
