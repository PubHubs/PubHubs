// Packages
import VueDatePicker from '@vuepic/vue-datepicker';
import '@vuepic/vue-datepicker/dist/main.css';
import mavonEditor from 'mavon-editor';
import 'mavon-editor/dist/css/index.css';
import { createPinia } from 'pinia';
import { createApp } from 'vue';

// Assets
import '@hub-client/assets/datepicker.css';
import '@hub-client/assets/tailwind.css';

// Logic
import { clickOutside, focus, twClass } from '@hub-client/logic/core/directives';
import { router } from '@hub-client/logic/core/router';

// Pages
import App from '@hub-client/pages/App.vue';

import { ReplaceConsole } from '@hub-client/console';
import { setUpi18n } from '@hub-client/i18n';
import { registerComponents } from '@hub-client/registerComponents';
import '@hub-client/registerServiceWorker';

// Other

ReplaceConsole();

const pinia = createPinia();
const app = createApp(App);

registerComponents(app);

const i18n = setUpi18n(app);
app.use(i18n);

app.use(router);
app.use(pinia);

app.use(mavonEditor);
app.directive('focus', focus);
app.directive('tw-class', twClass);
app.directive('click-outside', clickOutside);
app.component('VueDatePicker', VueDatePicker);

app.mount('#app');
