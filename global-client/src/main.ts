/* eslint-disable */
import '@/assets/tailwind.css';
import { focus, twClass } from '@/core/directives';
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
import { Logger } from '@/../../hub-client/src/foundation/Logger';
import { CONFIG } from '../../hub-client/src/foundation/Config';
ReplaceConsole();

const LOGGER = new Logger('GC', CONFIG);

const i18n = setUpi18n();

const router = createRouter({
	history: createWebHashHistory(),
	routes: routes,
	scrollBehavior(to, _from, savedPosition) {
		// Always scroll to the top of the page when the user is in the onboarding flow
		if (savedPosition && to.name != 'onboarding') {
			return savedPosition;
		} else {
			return { top: 0 };
		}
	},
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

app.mount('#app');

export { LOGGER };
