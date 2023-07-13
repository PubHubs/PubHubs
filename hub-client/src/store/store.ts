/**
 * All stores in one for easier import
 */

import { User, defaultUser, useUser } from '@/store/user'
import { Theme, defaultSettings, useSettings, type i18nSettings } from '@/store/settings'
import { useHubSettings } from '@/store/hub-settings'
import { Room, useRooms } from '@/store/rooms'
import { MessageType, Message, MessageBoxType, useMessageBox } from '@/store/messagebox'
import { buttonsSubmitCancel, DialogButton, DialogProperties, useDialog, DialogButtonAction, DialogFalse, DialogTrue } from '@/store/dialog'

export { User, defaultUser, useUser, Theme, defaultSettings, useSettings, type i18nSettings, useHubSettings, Room, useRooms, MessageType, Message, MessageBoxType, useMessageBox, buttonsSubmitCancel, DialogButton, DialogProperties, useDialog, type DialogButtonAction, DialogFalse, DialogTrue }
