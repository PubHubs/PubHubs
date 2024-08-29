/**
 * All stores in one for easier import, and for stores wich code can be used by both clients, the pinia import can be done here.
 */
import { useGlobal, PinnedHub, PinnedHubs } from '@/store/global';
import { Hub, HubList, useHubs } from '@/store/hubs';
import { buttonsSubmitCancel, DialogButton, DialogProperties, useDialog, DialogButtonAction, DialogCancel, DialogOk, DialogYes, DialogNo, DialogSubmit } from '@/store/dialog';
import { Theme, TimeFormat, defaultSettings, useSettings, i18nSettings } from '@/store/settings';
import { iframeHubId, MessageType, Message, MessageBoxType, useMessageBox } from '../../../hub-client/src/store/messagebox';

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
	DialogCancel,
	DialogOk,
	DialogYes,
	DialogNo,
	DialogSubmit,
	iframeHubId,
	MessageType,
	Message,
	MessageBoxType,
	useMessageBox,
};
