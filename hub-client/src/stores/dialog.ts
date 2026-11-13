// Packages
import { defineStore } from 'pinia';

import { type TVariant } from '@hub-client/components/elements/Button.vue';

// Logic
import { createLogger } from '@hub-client/logic/logging/Logger';

// Stores
import { Message, MessageType, useMessageBox } from '@hub-client/stores/messagebox';

// Other

/**
 * Global Dialog, uses components/ui/Dialog.vue component which is globally present in App.vue
 */

// Types
type DialogButtonAction = number;

// The dialog opened with show(), rendered by the shared Dialog instance in App.vue
type DialogEntry = {
	id: number;
	properties: DialogProperties;
	resolve: (action: DialogButtonAction) => void;
};

const DialogCancel = 0;
const DialogNo = 0;
const DialogOk = 1;
const DialogYes = 1;
const DialogSubmit = 1;

const logger = createLogger('Dialog');

const NESTED_DIALOG_ERROR =
	'A dialog was opened while another dialog is open. Dialogs on top of dialogs are not allowed: make the first one a page or close it first.';

/**
 * DialogButton class with:
 * - label
 * - color
 * - action (return value)
 */
class DialogButton {
	label: string;
	color: TVariant;
	enabled: boolean;
	action: DialogButtonAction;

	constructor(label = '', color = '' as TVariant, action = DialogCancel) {
		this.label = label;
		this.color = color;
		this.action = action;
		this.enabled = true;
	}
}

const buttonsOk: Array<DialogButton> = [new DialogButton('ok', 'primary', DialogOk)];

const buttonsCancel: Array<DialogButton> = [new DialogButton('cancel', 'error', DialogCancel)];

const buttonsOkCancel: Array<DialogButton> = [new DialogButton('ok', 'primary', DialogOk), new DialogButton('cancel', 'error', DialogCancel)];

const buttonsSubmitCancel: Array<DialogButton> = [new DialogButton('submit', 'primary', DialogSubmit), new DialogButton('cancel', 'secondary', DialogCancel)];

const buttonsYesNo: Array<DialogButton> = [new DialogButton('yes', 'primary', DialogYes), new DialogButton('no', 'error', DialogNo)];

/**
 * DailogProperties class with all the properties a dialog needs
 */
class DialogProperties {
	title: string;
	content: string;
	buttons: Array<DialogButton>;
	modal: boolean;
	modalonly: boolean;
	close: boolean;
	message: boolean;
	type: 'global' | 'hub';

	constructor(title = '', content = '', buttons: Array<DialogButton> = [], modal = true, close = true, type: 'global' | 'hub' = 'hub') {
		this.title = title;
		this.content = content;
		this.buttons = buttons;
		this.modal = modal;
		this.modalonly = false;
		this.close = close;
		this.message = false;
		this.type = type;
	}
}

/**
 * The main dialog store
 *
 * Only one dialog can be open at a time: never open a dialog from inside another dialog. A dialog that needs a
 * confirmation or a follow-up step should become a page or put that step in its own content. Opening a second
 * dialog logs an error; show() refuses it and answers DialogCancel.
 */
const useDialog = defineStore('dialog', {
	state: () => {
		return {
			global: false,
			nextId: 1,
			// The dialog opened with show(), rendered by App.vue
			entry: null as DialogEntry | null,
			// The open dialog, a component dialog or the entry
			openId: null as number | null,
			// Whatever currently needs the parent frame's modal: the open dialog and other overlays such as the image lightbox
			modalHolders: [] as number[],
		};
	},

	actions: {
		asGlobal(global = true) {
			this.global = global;
		},

		newId(): number {
			return this.nextId++;
		},

		/**
		 * Called by every dialog when it opens, and by show() for the dialog rendered from the store.
		 *
		 * @returns the id to unregister with
		 */
		register(): number {
			if (this.openId !== null) {
				logger.error(NESTED_DIALOG_ERROR);
			}
			const id = this.newId();
			this.openId = id;
			this.holdModal(id);
			return id;
		},

		unregister(id: number) {
			if (this.openId === id) this.openId = null;
			this.releaseModal(id);
		},

		/**
		 * Asks the parent frame to cover its own UI.
		 *
		 * @param holder an id from newId() or register()
		 */
		holdModal(holder: number) {
			if (this.modalHolders.includes(holder)) return;
			this.modalHolders.push(holder);
			if (this.modalHolders.length === 1) this.sendModal(MessageType.DialogShowModal);
		},

		releaseModal(holder: number) {
			if (!this.modalHolders.includes(holder)) return;
			this.modalHolders = this.modalHolders.filter((h) => h !== holder);
			if (this.modalHolders.length === 0) this.sendModal(MessageType.DialogHideModal);
		},

		sendModal(type: MessageType.DialogShowModal | MessageType.DialogHideModal) {
			if (globalThis.self !== window.top) {
				const messagebox = useMessageBox();
				messagebox.sendMessage(new Message(type));
			}
		},

		/**
		 * Call this to show a generic dialog with the given properties.
		 *
		 * @param properties DialogProperties
		 * @returns Promise with the answer of the pressed button, DialogCancel when another dialog is already open
		 */
		show(properties: DialogProperties | null = null): Promise<DialogButtonAction> {
			if (this.openId !== null) {
				logger.error(NESTED_DIALOG_ERROR);
				return Promise.resolve(DialogCancel);
			}
			return new Promise((resolve) => {
				this.entry = { id: this.register(), properties: properties ?? new DialogProperties(), resolve };
			});
		},

		/**
		 * Closes the dialog opened with show() and gives the answer back to whoever opened it
		 *
		 * @param id the entry's id
		 * @param returnValue the answer that will be given back
		 */
		close(id: number, returnValue: DialogButtonAction) {
			const entry = this.entry;
			if (entry?.id !== id) return;
			this.entry = null;
			this.unregister(id);
			entry.resolve(returnValue);
		},

		/**
		 * Shows a simple confirm dialog, with an error prefix, with only an 'Ok' button.
		 *
		 * @param title Text in the header of the dialog (prefixed by an error)
		 * @param content @default[''] Text in the main area of the dialog
		 * @param type @default['hub'] Type of dialog ('global' or 'hub')
		 * @returns
		 */
		async showError(title: string, content: string = '', type: 'global' | 'hub' = 'hub') {
			// On demand: importing i18n.ts at module scope drags both locale catalogues into the
			// startup graph of everything that touches this store, the miniclient included.
			const { getI18n } = await import('@hub-client/i18n');
			const i18n = getI18n();
			const { t } = i18n.global;
			const message = t('errors.error', title);
			return this.show(new DialogProperties(message, content, buttonsOk, true, true, type));
		},

		/**
		 * Shows a simple confirm dialog with only an 'Ok' button.
		 *
		 * @param title Text in the header of the dialog
		 * @param content @default[''] Text in the main area of the dialog
		 * @param type @default['hub'] Type of dialog ('global' or 'hub')
		 * @returns
		 */
		confirm(title: string, content: string = '', type: 'global' | 'hub' = 'hub') {
			return this.show(new DialogProperties(title, content, buttonsOk, true, true, type));
		},

		/**
		 * Shows a simple confirm dialog with only the 'Ok' and 'Cancel' buttons.
		 *
		 * @param title Text in the header of the dialog
		 * @param content @default[''] Text in the main area of the dialog
		 * @param type @default['hub'] Type of dialog ('global' or 'hub')
		 * @returns
		 */
		okcancel(title: string, content: string = '', type: 'global' | 'hub' = 'hub') {
			return this.show(new DialogProperties(title, content, buttonsOkCancel, true, true, type));
		},

		/**
		 * Shows a simple confirm dialog with only the 'Yes' and 'No' buttons.
		 *
		 * @param title Text in the header of the dialog
		 * @param content @default[''] Text in the main area of the dialog
		 * @param type @default['hub'] Type of dialog ('global' or 'hub')
		 * @returns
		 */
		yesno(title: string, content: string = '', type: 'global' | 'hub' = 'hub') {
			return this.show(new DialogProperties(title, content, buttonsYesNo, true, true, type));
		},
	},
});

export {
	buttonsOk,
	buttonsCancel,
	buttonsSubmitCancel,
	buttonsOkCancel,
	buttonsYesNo,
	DialogButton,
	type DialogButtonAction,
	type DialogEntry,
	DialogCancel,
	DialogOk,
	DialogYes,
	DialogNo,
	DialogSubmit,
	DialogProperties,
	useDialog,
};
