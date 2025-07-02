/**
 * All stores in one for easier import, and for stores wich code can be used by both clients, the pinia import can be done here.
 * Make sure there is no circular dependency created by this import
 * Files exporting the exports here cannot import from this file, but only from the individual files!
 */
import { useGlobal, PinnedHub, PinnedHubs } from '@/logic/store/global';
import { useHubs } from '@/logic/store/hubs';
import { buttonsSubmitCancel, DialogButton, DialogProperties, useDialog, DialogButtonAction, DialogCancel, DialogOk, DialogYes, DialogNo, DialogSubmit } from '@/logic/store/dialog';
import { Theme, TimeFormat, defaultSettings, useSettings, i18nSettings } from '@/logic/store/settings';
import { iframeHubId, MessageType, Message, MessageBoxType, useMessageBox } from '../../../../hub-client/src/logic/store/messagebox';

export {
	useGlobal,
	type PinnedHub,
	type PinnedHubs,
	Theme,
	TimeFormat,
	defaultSettings,
	useSettings,
	type i18nSettings,
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
