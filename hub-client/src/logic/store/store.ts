/**
 * All stores in one for easier import, and for stores wich code can be used by both clients, the pinia import can be done here.
 */

import { ConnectionState } from '@/logic/store/connection';
import { buttonsSubmitCancel, DialogButton, DialogButtonAction, DialogCancel, DialogNo, DialogOk, DialogProperties, DialogSubmit, DialogYes, useDialog } from '@/logic/store/dialog';
import { useHubSettings } from '@/logic/store/hub-settings';
import { Message, MessageBoxType, useMessageBox } from '@/logic/store/messagebox';
import { SecuredRoomAttributes, TEvent, TPublicRoom, TSecuredRoom, useRooms } from '@/logic/store/rooms';

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
