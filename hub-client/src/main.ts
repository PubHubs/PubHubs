import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router';
import '@/registerServiceWorker'
import '@/assets/tailwind.css'
import { setUpi18n } from '@/i18n';

import { registerComponents } from '@/registerComponents.js';

import { routes } from '@/core/routes';
import { focus, twClass } from '@/core/directives';
import App from '@/pages/App.vue'

import { ReplaceConsole } from '@/console';
ReplaceConsole();

const i18n = setUpi18n();

const router = createRouter({
    history: createWebHashHistory(),
    routes: routes,
});
const pinia = createPinia()
const app = createApp(App);

registerComponents(app);

app.use(router);
app.use(pinia);
app.use(i18n);
app.directive('focus', focus);
app.directive('tw-class', twClass);

app.mount('#app');
