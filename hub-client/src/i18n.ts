import { createI18n } from 'vue-i18n';

import {nl} from '@/locales/nl';
import {en} from '@/locales/en';

const supportedLanguages = ['nl', 'en'];
const fallbackLanguage = 'en';
let setLanguage = fallbackLanguage;

const browserLanguage = navigator.language;
if ( supportedLanguages.indexOf(browserLanguage) >= 0 ) {
    setLanguage = browserLanguage;
}

const i18n = createI18n({
    legacy: false,
    warnHtmlMessage: false,
    globalInjection: true,
    locale: setLanguage,
    fallbackLocale: fallbackLanguage,
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

export { i18n, supportedLanguages, setLanguage }
