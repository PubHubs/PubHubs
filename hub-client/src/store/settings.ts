/**
 * This store is used for global and user settings.
 */

import { defineStore } from 'pinia';
import { MessageType, Message, useMessageBox } from '@/store/messagebox';
import { fallbackLanguage } from '@/i18n';

enum Theme {
	System = 'system',
	Light = 'light',
	Dark = 'dark',
}

type i18nSettings = {
	locale: any;
	availableLocales: any;
};

interface Settings {
	/**
	 * The number of events to load on a page in a room.
	 */
	pagination: number;

	/**
	 * UI theme: system|dark|light
	 */
	theme: Theme;

	/**
	 * UI Language
	 */
	language: string;

	_i18n?: i18nSettings;
}

const defaultSettings: Settings = {
	theme: Theme.Dark,
	pagination: 50,
	language: fallbackLanguage,
	_i18n: {
		locale: undefined,
		availableLocales: undefined,
	},
};

const useSettings = defineStore('settings', {
	state: () => {
		return defaultSettings as Settings;
	},

	getters: {
		getPagination: (state: Settings) => state.pagination,

		/**
		 * Get theme set in preferences
		 */
		getSetTheme: (state: Settings): Theme => {
			return state.theme;
		},

		/**
		 * Get theme set in preferences, and if 'system' give the 'light' or 'dark' theme depending on system.
		 */
		getActiveTheme: (state: Settings): Theme => {
			if (state.theme != Theme.System) {
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

		/**
		 * Get themes as options (for form selecting).
		 * If nothing is given the label will be a capitalized version of the theme. If a function is given, the function will be used to generate the label. So you can give the localisation function $t.
		 */
		getThemeOptions: () => (themes: Function | undefined) => {
			const options = Object.values(Theme).map((e) => {
				if (typeof themes !== 'function') {
					return {
						label: e.charAt(0).toUpperCase() + e.slice(1),
						value: e,
					};
				} else {
					return {
						label: themes('themes.' + e),
						value: e,
					};
				}
			});
			return options;
		},

		getLanguageOptions: (state: Settings) => {
			const options = state._i18n?.availableLocales.map((e: string) => {
				return {
					label: e.toUpperCase(),
					value: e,
				};
			});
			return options;
		},
	},

	actions: {
		initI18b(init: any) {
			this._i18n = init;
			this.language = init.locale.value;
		},

		setPagination(newPagination: number) {
			this.pagination = newPagination;
		},

		setTheme(newTheme: Theme, send: boolean = false) {
			if (this.theme !== newTheme) {
				this.theme = newTheme;
				if (send) this.sendSettings();
			}
		},

		setLanguage(newLanguage: string, send: boolean = false) {
			if (this.language !== newLanguage && this._i18n?.availableLocales.indexOf(newLanguage) >= 0) {
				this.language = newLanguage;
				if (send) this.sendSettings();
			}
		},

		sendSettings() {
			const messagebox = useMessageBox();
			messagebox.sendMessage(
				new Message(MessageType.Settings, {
					theme: this.theme,
					language: this.language,
				}),
			);
		},
	},
});

export { Theme, Settings, defaultSettings, useSettings, type i18nSettings };
