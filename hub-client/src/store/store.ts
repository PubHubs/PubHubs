/**
 * All stores in one for easier import, and for stores wich code can be used by both clients, the pinia import can be done here.
 */

import { User, defaultUser, useUser } from '@/store/user';
import { ConnectionState, useConnection } from '@/store/connection';
import { Theme, TimeFormat, defaultSettings, useSettings, type i18nSettings, featureFlagType, HubInformation } from '@/store/settings';
import { useHubSettings } from '@/store/hub-settings';
import { RoomType, Room, TEvent, TPublicRoom, SecuredRoomAttributes, TSecuredRoom, useRooms } from '@/store/rooms';
import { MessageType, Message, MessageBoxType, useMessageBox } from '@/store/messagebox';
import { buttonsSubmitCancel, DialogButton, DialogProperties, useDialog, DialogButtonAction, DialogCancel, DialogOk, DialogYes, DialogNo, DialogSubmit } from '@/store/dialog';

export {
	User,
	defaultUser,
	useUser,
	ConnectionState,
	useConnection,
	Theme,
	TimeFormat,
	defaultSettings,
	useSettings,
	type i18nSettings,
	featureFlagType,
	useHubSettings,
	RoomType,
	Room,
	type TEvent,
	type TPublicRoom,
	type SecuredRoomAttributes,
	type TSecuredRoom,
	useRooms,
	MessageType,
	Message,
	MessageBoxType,
	useMessageBox,
	buttonsSubmitCancel,
	DialogButton,
	DialogProperties,
	useDialog,
	type DialogButtonAction,
	DialogCancel,
	DialogOk,
	DialogYes,
	DialogNo,
	DialogSubmit,
	type HubInformation,
};
