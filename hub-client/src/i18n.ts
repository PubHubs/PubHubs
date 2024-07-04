import { App } from 'vue';
import { I18nOptions, createI18n } from 'vue-i18n';
import { mergeDeep } from './core/extensions';

import { nl } from '@/locales/nl';
import { en } from '@/locales/en';

const supportedLanguages = ['nl', 'en'];
const fallbackLanguage = 'en';

const i18nOptions: I18nOptions = {
	legacy: false,
	warnHtmlMessage: false,
	globalInjection: true,
	locale: fallbackLanguage,
	fallbackLocale: fallbackLanguage,
	messages: {
		nl: nl,
		en: en,
	},
	datetimeFormats: {
		nl: {
			shorter: {
				hour: 'numeric',
				minute: 'numeric',
			},
			short: {
				year: 'numeric',
				month: 'long',
				day: 'numeric',
			},
			long: {
				year: 'numeric',
				month: 'long',
				day: 'numeric',
				weekday: 'long',
				hour: 'numeric',
				minute: 'numeric',
			},
		},
		en: {
			shorter: {
				hour: 'numeric',
				minute: 'numeric',
			},
			short: {
				year: 'numeric',
				month: 'long',
				day: 'numeric',
			},
			long: {
				year: 'numeric',
				month: 'long',
				day: 'numeric',
				weekday: 'long',
				hour: 'numeric',
				minute: 'numeric',
			},
		},
	},
};

const setUpi18n = function (app?: App) {
	// Add plugin messages if any
	if (typeof app !== 'undefined') {
		let pluginMessages = {};
		app.config.globalProperties._plugins.forEach((plugin: any) => {
			if (plugin.i18n_messages) {
				pluginMessages = mergeDeep(pluginMessages, plugin.i18n_messages);
			}
		});
		i18nOptions.messages = mergeDeep(i18nOptions.messages, pluginMessages);
	}
	const i18n = createI18n(i18nOptions);
	setLanguage(i18n, fallbackLanguage);
	return i18n;
};

const setLanguage = function (i18n: any, language: string) {
	i18n.global.locale.value = language;
};

const currentLanguage = function (i18n: any) {
	return i18n.global.locale.value;
};

export { setUpi18n, setLanguage, fallbackLanguage, currentLanguage, supportedLanguages };
