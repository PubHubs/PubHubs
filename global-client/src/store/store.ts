/**
 * All stores in one for easier import, and for stores wich code can be used by both clients, the pinia import can be done here.
 */

import { defineStore } from 'pinia';

import { useGlobal, PinnedHub, PinnedHubs } from '@/store/global';
import { Hub, HubList, useHubs } from '@/store/hubs';
import { buttonsSubmitCancel, DialogButton, DialogProperties, useDialog, DialogButtonAction, DialogFalse, DialogTrue } from '@/store/dialog';
import { Theme, TimeFormat, defaultSettings, createSettings, i18nSettings } from '@/store/settings';
import { iframeHubId, MessageType, Message, MessageBoxType, useMessageBox } from '../../../hub-client/src/store/messagebox';

const useSettings = createSettings(defineStore);

export {
	useGlobal,
	type PinnedHub,
	type PinnedHubs,
	Theme,
	TimeFormat,
	defaultSettings,
	useSettings,
	type i18nSettings,
	Hub,
	type HubList,
	useHubs,
	buttonsSubmitCancel,
	DialogButton,
	DialogProperties,
	useDialog,
	type DialogButtonAction,
	DialogFalse,
	DialogTrue,
	iframeHubId,
	MessageType,
	Message,
	MessageBoxType,
	useMessageBox,
};
