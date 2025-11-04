// Packages
import { App } from 'vue';
import { I18nOptions, createI18n } from 'vue-i18n';

// Locales
import { en } from '@hub-client/locales/en';
// Logic
import { nl } from '@hub-client/locales/nl';

// Types
type Language = 'nl' | 'en';

const supportedLanguages: Language[] = ['nl', 'en'];

// The default language is determined by the browser
const defaultLanguage = getLanguageFromBrowser() || 'en';

// The static site can communicate the user's language preference through the query parameter 'lang'.
// Usefull when the user is not logged in, but did choose a language on the static site.
const fallbackLanguage = getLanguageFromQueryParam() || defaultLanguage;

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
				hour12: false,
			},
			shorter12Hour: {
				hour: 'numeric',
				minute: 'numeric',
				hour12: true,
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

function getLanguageFromBrowser(): Language | null {
	const lang = navigator.language;
	if (lang && languageIsSupported(lang)) {
		return lang;
	} else {
		return null;
	}
}

function getLanguageFromQueryParam(): Language | null {
	const lang = new URLSearchParams(window.location.search).get('lang');

	if (lang && languageIsSupported(lang)) {
		return lang;
	} else {
		return null;
	}
}

function languageIsSupported(language: string): language is Language {
	return supportedLanguages.includes(language as Language);
}

export { Language, currentLanguage, fallbackLanguage, setLanguage, setUpi18n, supportedLanguages };
