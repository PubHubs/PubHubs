// Packages
import { VueDatePicker } from '@vuepic/vue-datepicker';
import '@vuepic/vue-datepicker/dist/main.css';
// Logic
import loglevel from 'loglevel';
import { createPinia } from 'pinia';
import { createApp } from 'vue';

// Assets
import '@hub-client/assets/datepicker.css';
import '@hub-client/assets/tailwind.css';

import { clickOutside, contextMenu, focus, twClass } from '@hub-client/logic/core/directives';
import { router } from '@hub-client/logic/core/router';
import { getLogLevel } from '@hub-client/logic/logging/Logger';

// Pages
import App from '@hub-client/pages/App.vue';

import { setUpi18n } from '@hub-client/i18n';

// Silence matrix-js-sdk's verbose HTTP logs; match our app log level
const matrixLevel = getLogLevel() === 'debug' ? 'DEBUG' : getLogLevel() === 'info' ? 'INFO' : getLogLevel() === 'error' ? 'ERROR' : 'WARN';
loglevel.getLogger('matrix').setLevel(matrixLevel);

const pinia = createPinia();
const app = createApp(App);

const i18n = setUpi18n(app);
app.use(i18n);

app.use(router);
app.use(pinia);

app.directive('focus', focus);
app.directive('tw-class', twClass);
app.directive('click-outside', clickOutside);
app.directive('context-menu', contextMenu);
app.component('VueDatePicker', VueDatePicker);

app.mount('#app');
