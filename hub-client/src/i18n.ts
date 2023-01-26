import { createI18n } from 'vue-i18n';

import nl from '@/locales/nl.json';
import en from '@/locales/en.json';

const supportedLanguages = ['nl', 'en'];
const fallbackLocale = 'en';
let setLocale = fallbackLocale;

const browserLanguage = navigator.language;
if ( supportedLanguages.indexOf(browserLanguage) >= 0 ) {
    setLocale = browserLanguage;
}

const i18n = createI18n({
    legacy: false,
    globalInjection: true,
    locale: setLocale,
    fallbackLocale: fallbackLocale,
    messages: {
        nl: nl,
        en: en,
    },
    datetimeFormats: {
        nl : {
            short: {
                year: 'numeric', month: 'short', day: 'numeric'
            },
            long: {
                year: 'numeric', month: 'long', day: 'numeric',
                weekday: 'long', hour: 'numeric', minute: 'numeric'
            }
        },
        en : {
            short: {
                year: 'numeric', month: 'short', day: 'numeric'
            },
            long: {
                year: 'numeric', month: 'long', day: 'numeric',
                weekday: 'long', hour: 'numeric', minute: 'numeric'
            }
        }
    }
});

export { i18n, supportedLanguages }
