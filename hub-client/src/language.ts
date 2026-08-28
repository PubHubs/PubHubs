// Which language to use, kept apart from i18n.ts on purpose.
//
// i18n.ts statically imports both locale catalogues (~92 KB) plus vue-i18n and @intlify
// (~120 KB). Everything below is derived from navigator.language and the query string and
// needs none of it, so stores that only want to know the language — settings.ts, and through
// it the miniclient — should import from here and leave the catalogues out of their graph.

type Language = 'nl' | 'en';

const supportedLanguages: Language[] = ['nl', 'en'];

function languageIsSupported(language: string): language is Language {
	return supportedLanguages.includes(language as Language);
}

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

// The default language is determined by the browser
const defaultLanguage = getLanguageFromBrowser() || 'nl';

// The static site can communicate the user's language preference through the query parameter 'lang'.
// Usefull when the user is not logged in, but did choose a language on the static site.
const fallbackLanguage = getLanguageFromQueryParam() || defaultLanguage;

export { Language, supportedLanguages, languageIsSupported, defaultLanguage, fallbackLanguage };
