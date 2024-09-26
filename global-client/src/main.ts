/* eslint-disable */
import '@/assets/tailwind.css';
import { focus, twClass, clickOutside } from '@/core/directives';
import { routes } from '@/core/routes';
import { setUpi18n } from '@/i18n';
import '@/registerServiceWorker';
import { createPinia } from 'pinia';
import { createApp, markRaw } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';

// Local components
import App from '@/pages/App.vue';
import { registerComponents } from '@/registerComponents.js';

// Components from hub-client
import Badge from '@/../../hub-client/src/components/elements/Badge.vue';
import Button from '@/../../hub-client/src/components/elements/Button.vue';
import H1 from '@/../../hub-client/src/components/elements/H1.vue';
import H2 from '@/../../hub-client/src/components/elements/H2.vue';
import H3 from '@/../../hub-client/src/components/elements/H3.vue';
import Icon from '@/../../hub-client/src/components/elements/Icon.vue';
import Line from '@/../../hub-client/src/components/elements/Line.vue';
import P from '@/../../hub-client/src/components/elements/P.vue';
import TruncatedText from '@/../../hub-client/src/components/elements/TruncatedText.vue';
import ButtonGroup from '@/../../hub-client/src/components/forms/ButtonGroup.vue';
import Label from '@/../../hub-client/src/components/forms/Label.vue';
import Dialog from '@/../../hub-client/src/components/ui/Dialog.vue';
import Logo from '@/../../hub-client/src/components/ui/Logo.vue';
import Checkbox from '@/../../hub-client/src/components/forms/Checkbox.vue';

import { ReplaceConsole } from '@/../../hub-client/src/console';
import { Logger } from '@/../../hub-client/src/dev/Logger';
ReplaceConsole();

const LOGGER = new Logger('GC');

const i18n = setUpi18n();

const router = createRouter({
	history: createWebHashHistory(),
	routes: routes,
	sensitive: true,
});

const pinia = createPinia();
pinia.use(({ store }) => {
	store.router = markRaw(router);
});
const app = createApp(App);

registerComponents(app);

app.component('P', P);
app.component('H1', H1);
app.component('H2', H2);
app.component('H3', H3);
app.component('Icon', Icon);
app.component('Line', Line);
app.component('Label', Label);
app.component('Badge', Badge);
app.component('Button', Button);
app.component('TruncatedText', TruncatedText);
app.component('ButtonGroup', ButtonGroup);
app.component('Logo', Logo);
app.component('Dialog', Dialog);
app.component('Checkbox', Checkbox);

app.use(router);
app.use(pinia);
app.use(i18n as any);
app.directive('focus', focus);
app.directive('tw-class', twClass as any);
app.directive('click-outside', clickOutside);

app.mount('#app');

export { LOGGER };
