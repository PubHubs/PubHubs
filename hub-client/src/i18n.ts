// Packages
import { type Locale, enGB as localeEN, nl as localeNL } from 'date-fns/locale';
import { type App } from 'vue';
import { type I18nOptions, createI18n } from 'vue-i18n';

// Locales
import { en } from '@hub-client/locales/en';
// Logic
import { nl } from '@hub-client/locales/nl';

// Re-exported so existing importers of '@hub-client/i18n' keep working.
import { fallbackLanguage } from '@hub-client/language';

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

// Save a shared instance for stores to translate without a setup context
let _i18n: ReturnType<typeof setUpi18n> | null = null;

const setUpi18n = function (_app?: App) {
	const i18n = createI18n(i18nOptions);
	_i18n = i18n;
	setLanguage(i18n, fallbackLanguage);
	return i18n;
};

const setLanguage = function (i18n: { global: { locale: unknown } }, language: string) {
	(i18n.global.locale as { value: string }).value = language;
	document.documentElement.lang = language;
};

const currentLanguage = function (i18n: { global: { locale: unknown } }) {
	return (i18n.global.locale as { value: string }).value;
};

// Returns the shared instance so stores can translate without a setup context.
const getI18n = function () {
	return _i18n ?? setUpi18n();
};

export { currentLanguage, fallbackLanguage, setLanguage, setUpi18n, languageLocale, getI18n };

export { type Language, supportedLanguages } from '@hub-client/language';
