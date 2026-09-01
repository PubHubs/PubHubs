// Packages
import { type Locale, enGB as localeEN, nl as localeNL } from 'date-fns/locale';
import { type App } from 'vue';
import { type I18nOptions, createI18n } from 'vue-i18n';

// Locales
import { en } from '@hub-client/locales/en';
// Logic
import { nl } from '@hub-client/locales/nl';

// Re-exported so existing importers of '@hub-client/i18n' keep working.
import { type Language, fallbackLanguage, supportedLanguages } from '@hub-client/language';

// associate locale to language
const languageLocale: Record<string, Locale> = {
	en: localeEN,
	nl: localeNL,
};

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
				hour12: false,
			},
			shorter12Hour: {
				hour: 'numeric',
				minute: 'numeric',
				hour12: true,
			},
			short: {
				year: '2-digit',
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
				hour12: false,
			},
			shorter12Hour: {
				hour: 'numeric',
				minute: 'numeric',
				hour12: true,
			},
			short: {
				year: '2-digit',
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

const setUpi18n = function (_app?: App) {
	const i18n = createI18n(i18nOptions);
	setLanguage(i18n, fallbackLanguage);
	return i18n;
};

const setLanguage = function (i18n: { global: { locale: unknown } }, language: string) {
	(i18n.global.locale as { value: string }).value = language;
};

const currentLanguage = function (i18n: { global: { locale: unknown } }) {
	return (i18n.global.locale as { value: string }).value;
};

export { Language, currentLanguage, fallbackLanguage, setLanguage, setUpi18n, supportedLanguages, languageLocale };
