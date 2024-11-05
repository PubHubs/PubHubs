/**
 * All stores in one for easier import, and for stores wich code can be used by both clients, the pinia import can be done here.
 */

import { ConnectionState } from '@/store/connection';
import { buttonsSubmitCancel, DialogButton, DialogButtonAction, DialogCancel, DialogNo, DialogOk, DialogProperties, DialogSubmit, DialogYes, useDialog } from '@/store/dialog';
import { useHubSettings } from '@/store/hub-settings';
import { Message, MessageBoxType, useMessageBox } from '@/store/messagebox';
import { SecuredRoomAttributes, TEvent, TPublicRoom, TSecuredRoom, useRooms } from '@/store/rooms';

export {
	buttonsSubmitCancel,
	ConnectionState,
	DialogButton,
	DialogCancel,
	DialogNo,
	DialogOk,
	DialogProperties,
	DialogSubmit,
	DialogYes,
	Message,
	MessageBoxType,
	useDialog,
	useHubSettings,
	useMessageBox,
	useRooms,
	type DialogButtonAction,
	type SecuredRoomAttributes,
	type TEvent,
	type TPublicRoom,
	type TSecuredRoom,
};
