import { createApp } from 'vue';
import { createPinia } from 'pinia';
import '@/registerServiceWorker';
import '@/assets/tailwind.css';
import { setUpi18n } from '@/i18n';

import { registerComponents } from '@/registerComponents.js';
import { registerPlugins, registerPluginComponents } from '@/registerPlugins.js';

import { router } from '@/core/router';
import { focus, twClass } from '@/core/directives';
import App from '@/pages/App.vue';

import { ReplaceConsole } from '@/console';
ReplaceConsole();

const pinia = createPinia();
const app = createApp(App);

registerComponents(app);
registerPlugins(app);
registerPluginComponents(app);

const i18n = setUpi18n(app);
app.use(i18n);

app.use(router);
app.use(pinia);
app.directive('focus', focus);
app.directive('tw-class', twClass);
app.mount('#app');
