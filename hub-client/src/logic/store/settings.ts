/**
 * This store is used for global and user settings.
 */
import { fallbackLanguage } from '@/i18n';
import { Message, MessageBoxType, MessageType, useMessageBox } from '@/logic/store/messagebox';
import { defineStore } from 'pinia';
import { CONFIG } from '../foundation/Config';

enum Theme {
	System = 'system',
	Light = 'light',
	Dark = 'dark',
}

type i18nSettings = { locale: any; availableLocales: any };

enum TimeFormat {
	format12 = 'format12',
	format24 = 'format24',
}

enum NotificationsPermission {
	Allow = 'allow',
	Deny = 'deny',
}

enum FeatureFlag {
	signedMessages = 'signedMessages',
	plugins = 'plugins',
	dateSplitter = 'dateSplitter',
	disclosure = 'disclosure',
	unreadMarkers = 'unreadmarkers',
	notifications = 'notifications',
	deleteMessages = 'deleteMessages',
	hubSettings = 'hubSettings',
	votingWidget = 'votingWidget',
	// Implemented with issue #984
	authenticatedMedia = 'authenticatedMedia',
	unreadCounter = 'unreadCounter',
	consent = 'consent',
	roomLibrary = 'roomLibrary',
}

type FeatureFlags = { [key in FeatureFlag]: boolean };

interface Settings {
	/**
	 * The number of events to load on a page in a room.
	 */
	pagination: number;

	/**
	 * Max length of displayname, Matrix has as default 255, but we like a shorter one.
	 */
	displayNameMaxLength: number;

	/**
	 * UI theme: system|dark|light
	 */
	theme: Theme;

	/**
	 * timeformat: format12|format24 12 hour system or 24 hour system
	 */
	timeformat: TimeFormat;

	/**
	 * notificationsPermission: allow|deny
	 */
	notificationsPermission: NotificationsPermission;

	/**
	 * UI Language
	 * Should have type 'Language', but for some reason the build gives an error when trying to import it from @/i18n.
	 */
	language: string;

	_i18n?: i18nSettings;

	featureFlags: { main: FeatureFlags; stable: FeatureFlags; local: FeatureFlags };
}

const defaultSettings: Settings = {
	theme: Theme.System,
	timeformat: TimeFormat.format24,
	pagination: 150,
	displayNameMaxLength: 40,
	language: fallbackLanguage,
	_i18n: { locale: undefined, availableLocales: undefined },
	// First check if the Notifications API is supported.
	notificationsPermission: 'Notification' in window ? (Notification.permission === 'denied' || Notification.permission === 'default' ? NotificationsPermission.Deny : NotificationsPermission.Allow) : NotificationsPermission.Deny,

	/**
	 * Enable/disable feature flags here.
	 * Please also write down which should be enabled on main and which on stable.
	 */
	featureFlags: {
		main: {
			signedMessages: true,
			plugins: true,
			dateSplitter: true,
			disclosure: false,
			unreadmarkers: true,
			notifications: true,
			deleteMessages: true,
			hubSettings: true,
			authenticatedMedia: true,
			unreadCounter: true,
			roomLibrary: true,
			votingWidget: true,
			consent: true,
		},
		stable: {
			signedMessages: true,
			plugins: true,
			dateSplitter: true,
			disclosure: false,
			unreadmarkers: true,
			notifications: true,
			deleteMessages: true,
			hubSettings: true,
			authenticatedMedia: true,
			unreadCounter: true,
			roomLibrary: false,
			votingWidget: true,
			consent: true,
		},
		local: {
			signedMessages: true,
			plugins: true,
			dateSplitter: true,
			disclosure: false,
			unreadmarkers: true,
			notifications: true,
			deleteMessages: true,
			hubSettings: false,
			authenticatedMedia: true,
			unreadCounter: true,
			roomLibrary: true,
			votingWidget: true,
			consent: false,
		},
	},
};

const useSettings = defineStore('settings', {
	state: () => ({
		...defaultSettings,
		isMobileState: true as boolean | undefined,
	}),

	getters: {
		getPagination: (state: Settings) => state.pagination,
		getDisplayNameMaxLength: (state: Settings) => state.displayNameMaxLength,

		/**
		 * Get theme set in preferences
		 */
		getSetTheme: (state: Settings): Theme => {
			return state.theme;
		},

		/**
		 * Get theme set in preferences, and if 'system' give the 'light' or 'dark' theme depending on system.
		 */
		getActiveTheme: (state: Settings): Theme.Light | Theme.Dark => {
			if (state.theme !== Theme.System) {
				return state.theme;
			}
			if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
				return Theme.Dark;
			}
			return Theme.Light;
		},

		getActiveLanguage: (state: Settings): string => {
			return state.language;
		},

		getTimeFormat: (state: Settings): TimeFormat => {
			return state.timeformat;
		},

		getNotificationsPermission: (state: Settings): NotificationsPermission => {
			return state.notificationsPermission;
		},

		/**
		 * Get timeformats as options (for form selecting).
		 * The function must be the localisation function $t.
		 */
		getTimeFormatOptions: () => (formats: Function) => {
			const options = Object.values(TimeFormat).map((e) => {
				return { label: formats('timeformats.' + e), value: e };
			});
			return options;
		},

		/**
		 * Get themes as options (for form selecting).
		 * If nothing is given the label will be a capitalized version of the theme. If a function is given, the function will be used to generate the label. So you can give the localisation function $t.
		 */
		getThemeOptions: () => (themes: Function | undefined) => {
			const options = Object.values(Theme).map((e) => {
				if (typeof themes !== 'function') {
					return { label: e.charAt(0).toUpperCase() + e.slice(1), value: e };
				} else {
					return { label: themes('themes.' + e), value: e };
				}
			});
			return options;
		},

		getLanguageOptions: (state: Settings) => {
			const options = state._i18n?.availableLocales?.map((e: string) => {
				return { label: e.toUpperCase(), value: e };
			});
			return options;
		},

		getNotificationOptions: () => (notifications: Function | undefined) => {
			const options = Object.values(NotificationsPermission).map((e) => {
				if (typeof notifications !== 'function') {
					return { label: e.charAt(0).toUpperCase() + e.slice(1), value: e };
				} else {
					return { label: notifications('notifications.' + e), value: e };
				}
			});
			return options;
		},
	},

	actions: {
		initI18b(init: any) {
			// @ts-ignore
			this._i18n = init;
			// @ts-ignore
			this.language = init.locale.value;
		},

		setPagination(newPagination: number) {
			// @ts-ignore
			this.pagination = newPagination;
		},

		setTheme(newTheme: Theme, send: boolean = false) {
			// @ts-ignore
			if (this.theme !== newTheme) {
				// @ts-ignore
				this.theme = newTheme;
				if (send) this.sendSettings();
			}
		},

		setTimeFormat(format: TimeFormat) {
			// @ts-ignore
			this.timeformat = format;
		},

		setNotificationPermission(perm: NotificationsPermission) {
			this.notificationsPermission = perm;
		},

		setLanguage(newLanguage: string, send: boolean = false) {
			// @ts-ignore
			if (this.language !== newLanguage && this._i18n?.availableLocales.indexOf(newLanguage) >= 0) {
				// @ts-ignore
				this.language = newLanguage;
				if (send) this.sendSettings();
			}
		},

		sendSettings() {
			const messagebox = useMessageBox();
			if (messagebox.type === MessageBoxType.Parent) {
				messagebox.sendMessage(
					new Message(MessageType.Settings, {
						// @ts-ignore
						theme: this.theme as any,
						// @ts-ignore
						timeformat: this.timeformat as any,
						// @ts-ignore
						language: this.language,
					}),
				);
			}
		},

		/**
		 * Checks whether a feature is enabled or not, for more control in the transition from development to production.
		 * Add features in the settins store featureFlags property.
		 */
		isFeatureEnabled(feature: FeatureFlag): boolean {
			switch (CONFIG.productionMode) {
				case 'development':
					return this.featureFlags.main[feature];
				case 'local development':
					return this.featureFlags.local[feature];
				case 'production':
				default:
					return this.featureFlags.stable[feature];
			}
		},

		updateIsMobile() {
			const isMobile = window.innerWidth < 1024;
			this.isMobileState = isMobile;

			const iframe = document.getElementById('hub-frame-id') as HTMLIFrameElement;
			if (iframe && iframe.contentWindow) {
				iframe.contentWindow.postMessage({ isMobileState: isMobile }, '*');
			}
		},

		startListening() {
			this.updateIsMobile();
			window.addEventListener('resize', this.updateIsMobile);
		},

		stopListening() {
			window.removeEventListener('resize', this.updateIsMobile);
		},
	},
});

type SettingsStore = ReturnType<typeof useSettings>;

export { defaultSettings, FeatureFlag, Settings, Theme, TimeFormat, NotificationsPermission, useSettings, type i18nSettings, SettingsStore };
