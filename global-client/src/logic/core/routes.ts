// Pages
import Hub from '@global-client/pages/Hub.vue';

// `releasesMiniclients` marks the pages that show the hub overview rather than opening a hub: the
// pinned-hub miniclients have nothing to stay out of the way of there, so the navigation guard lets
// them start warming up. See miniclientGate.composable.ts.
const routes = [
	{
		path: '/',
		name: 'hubs-overview',
		component: () => import('@global-client/pages/HubsOverview.vue'),
		meta: { requiresAuth: true, releasesMiniclients: true },
	},
	{ path: '/login', name: 'login', component: () => import('@global-client/pages/Login.vue'), meta: { requiresAuth: false } },
	{
		path: '/register',
		name: 'onboarding',
		component: () => import('@global-client/pages/Onboarding.vue'),
		meta: { requiresAuth: false },
	},
	{ path: '/hub/:name/:roomId?', name: 'hub', component: Hub, meta: { requiresAuth: true } },
	{
		path: '/error',
		name: 'error',
		component: () => import('@global-client/pages/ErrorPage.vue'),
		props: (route: { query: { errorKey: string; errorValues: Array<string | number> } }) => ({
			errorKey: route.query.errorKey || 'errors.general_error',
			errorValues: route.query.errorValues || [],
		}),
		meta: { requiresAuth: false },
	},
];

export { routes };
