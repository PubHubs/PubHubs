/**
 * All stores in one for easier import, and for stores wich code can be used by both clients, the pinia import can be done here.
 */

import { defineStore } from 'pinia';

import { User, defaultUser, useUser } from '@/store/user';
import { Theme, defaultSettings, createSettings, type i18nSettings } from '@/store/settings';
import { useHubSettings } from '@/store/hub-settings';
import { PubHubsRoomType, Room, PublicRoom, SecuredRoomAttributes, SecuredRoom, useRooms } from '@/store/rooms';
import { MessageType, Message, MessageBoxType, useMessageBox } from '@/store/messagebox';
import { buttonsSubmitCancel, DialogButton, DialogProperties, useDialog, DialogButtonAction, DialogFalse, DialogTrue } from '@/store/dialog';

const useSettings = createSettings(defineStore);

export {
	User,
	defaultUser,
	useUser,
	Theme,
	defaultSettings,
	useSettings,
	type i18nSettings,
	useHubSettings,
	PubHubsRoomType,
	Room,
	PublicRoom,
	type SecuredRoomAttributes,
	type SecuredRoom,
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
	DialogFalse,
	DialogTrue,
};
