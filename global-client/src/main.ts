// Assets
// Packages
import mavonEditor from 'mavon-editor';
import 'mavon-editor/dist/css/index.css';
import { createPinia } from 'pinia';
import { createApp, markRaw } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';

import '@hub-client/assets/tailwind.css';

// Logic
import { routes } from '@global-client/logic/core/routes';

import { focus, twClass } from '@hub-client/logic/core/directives';

// Pages
import App from '@global-client/pages/App.vue';

import { useGlobal } from '@global-client/stores/global';

import { setUpi18n } from '@hub-client/i18n';

// Set up internationalization
const i18n = setUpi18n();

// Set up router
const router = createRouter({
	history: createWebHashHistory(),
	routes: routes,
	scrollBehavior(to, _from, savedPosition) {
		// Always scroll to the top of the page when the user is in the onboarding flow
		if (savedPosition && to.name !== 'onboarding') {
			return savedPosition;
		} else {
			return { top: 0 };
		}
	},
	sensitive: true,
});
router.beforeEach((to, from) => {
	if (to.name === 'error' && from.name === undefined) {
		return { name: 'home' };
	}
});

router.beforeEach(async (to, _from) => {
	const global = useGlobal();
	const isLoggedIn = await global.checkLoginAndSettings();

	if (to.meta.requiresAuth && !isLoggedIn) {
		const redirectPath = to.fullPath;
		return { name: 'login', query: redirectPath === '/' ? {} : { redirect: redirectPath } };
	}
});

// Set up Pinia store
const pinia = createPinia();
pinia.use(({ store }) => {
	store.router = markRaw(router);
});

// Create Vue app
const app = createApp(App);

// Use plugins and directives
app.use(mavonEditor);
app.use(pinia);
app.use(router);
app.use(i18n as Parameters<typeof app.use>[0]);
app.directive('focus', focus);
app.directive('tw-class', twClass as Parameters<typeof app.directive>[1]);

// Mount the app
app.mount('#app');
