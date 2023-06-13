/* eslint-disable */
import { createApp, markRaw } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router';
import '@/registerServiceWorker'
import '@/assets/tailwind.css'
import { i18n } from '@/i18n';
import { routes } from '@/core/routes';
import { focus, twClass } from '@/core/directives';


// Local components
import App from '@/pages/App.vue'
import { registerComponents } from '@/registerComponents.js';

// Components from hub-client
import H1 from '@/../../hub-client/src/components/elements/H1.vue'
import H2 from '@/../../hub-client/src/components/elements/H2.vue'
import H3 from '@/../../hub-client/src/components/elements/H3.vue'
import Icon from '@/../../hub-client/src/components/elements/Icon.vue'
import Line from '@/../../hub-client/src/components/elements/Line.vue'
import Badge from '@/../../hub-client/src/components/elements/Badge.vue'
import Button from '@/../../hub-client/src/components/elements/Button.vue'
import TruncatedText from '@/../../hub-client/src/components/elements/TruncatedText.vue'
import ButtonGroup from '@/../../hub-client/src/components/forms/ButtonGroup.vue'
import Logo from '@/../../hub-client/src/components/ui/Logo.vue'
import Dialog from '@/../../hub-client/src/components/ui/Dialog.vue'

import { ReplaceConsole } from '@/../../hub-client/src/console';
ReplaceConsole();

const router = createRouter({
    history: createWebHashHistory(),
    routes: routes,
    sensitive:true,
});

const pinia = createPinia();
pinia.use(({ store }) => { store.router = markRaw(router) });
const app = createApp(App);

registerComponents(app);

app.component('H1',H1);
app.component('H2',H2);
app.component('H3',H3);
app.component('Icon',Icon);
app.component('Line',Line);
app.component('Badge',Badge);
app.component('Button',Button);
app.component('TruncatedText',TruncatedText);
app.component('ButtonGroup',ButtonGroup);
app.component('Logo',Logo);
app.component('Dialog',Dialog);

app.use(router);
app.use(pinia);
app.use(i18n);
app.directive('focus', focus);
app.directive('tw-class', twClass);

app.mount('#app');
