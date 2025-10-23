// Packages
import mavonEditor from 'mavon-editor';
import 'mavon-editor/dist/css/index.css';
import { createPinia } from 'pinia';
import { createApp, markRaw } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';

// Assets
import '@hub-client/assets/tailwind.css';

// Components
import Badge from '@hub-client/components/elements/Badge.vue';
import Button from '@hub-client/components/elements/Button.vue';
import H1 from '@hub-client/components/elements/H1.vue';
import H2 from '@hub-client/components/elements/H2.vue';
import H3 from '@hub-client/components/elements/H3.vue';
import Icon from '@hub-client/components/elements/Icon.vue';
import Line from '@hub-client/components/elements/Line.vue';
import P from '@hub-client/components/elements/P.vue';
import TruncatedText from '@hub-client/components/elements/TruncatedText.vue';
import ButtonGroup from '@hub-client/components/forms/ButtonGroup.vue';
import Checkbox from '@hub-client/components/forms/Checkbox.vue';
import Label from '@hub-client/components/forms/Label.vue';
import Dialog from '@hub-client/components/ui/Dialog.vue';
import Logo from '@hub-client/components/ui/Logo.vue';

// Logic
import { routes } from '@global-client/logic/core/routes';

import { focus, twClass } from '@hub-client/logic/core/directives';
import { CONFIG } from '@hub-client/logic/logging/Config';
import { Logger } from '@hub-client/logic/logging/Logger';

// Pages
import App from '@global-client/pages/App.vue';

import { useGlobal } from '@global-client/stores/global';

// Other
import { registerComponents } from '@global-client/registerComponents';
import '@global-client/registerServiceWorker';

import { ReplaceConsole } from '@hub-client/console';
import { setUpi18n } from '@hub-client/i18n';

// Custom console for development
ReplaceConsole();

// Initialize logger
const LOGGER = new Logger('GC', CONFIG);

// Set up internationalization
const i18n = setUpi18n();

// Set up router
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
router.beforeEach((to, from, next) => {
	// Redirect to home if navigating to error page from a browser refresh (undefined)
	if (to.name === 'error' && from.name === undefined) {
		next({ name: 'home' });
		return;
	}
	next();
});

router.beforeEach(async (to, _from, next) => {
	const global = useGlobal();
	const isLoggedIn = await global.checkLoginAndSettings();

	if (to.meta.requiresAuth && !isLoggedIn) {
		const redirectPath = to.fullPath;
		next({ name: 'login', query: redirectPath === '/' ? {} : { redirect: redirectPath } });
	} else {
		next();
	}
});

router.beforeEach((to, from, next) => {
	// Redirect to home if navigating to error page from a browser refresh (undefined)
	if (to.name === 'error' && from.name === undefined) {
		next({ name: 'home' });
		return;
	}
	next();
});

router.beforeEach(async (to, _from, next) => {
	const global = useGlobal();
	const isLoggedIn = await global.checkLoginAndSettings();

	if (to.meta.requiresAuth && !isLoggedIn) {
		const redirectPath = to.fullPath;
		next({ name: 'login', query: redirectPath === '/' ? {} : { redirect: redirectPath } });
	} else {
		next();
	}
});

// Set up Pinia store
const pinia = createPinia();
pinia.use(({ store }) => {
	store.router = markRaw(router);
});

// Create Vue app
const app = createApp(App);

// Register global components
registerComponents(app);

const components = {
	P,
	H1,
	H2,
	H3,
	Icon,
	Line,
	Label,
	Badge,
	Button,
	TruncatedText,
	ButtonGroup,
	Logo,
	Dialog,
	Checkbox,
};

Object.entries(components).forEach(([name, component]) => {
	app.component(name, component);
});

// Use plugins and directives
app.use(mavonEditor);
app.use(pinia);
app.use(router);
app.use(i18n as any);
app.directive('focus', focus);
app.directive('tw-class', twClass as any);

// Mount the app
app.mount('#app');

export { LOGGER };
