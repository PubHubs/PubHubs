import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router';
import '@/registerServiceWorker'
import '@/assets/tailwind.css'
import { i18n } from '@/i18n';

import { registerComponents } from '@/registerComponents.js';
import { PubHubs } from '@/core/pubhubs';
import { routes } from '@/core/routes';
import { focus, twClass } from '@/core/directives';
import App from '@/pages/App.vue'

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
app.provide('pubhubs', new PubHubs());
app.directive('focus', focus);
app.directive('tw-class', twClass);

app.mount('#app');
