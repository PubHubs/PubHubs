import Hub from '@/pages/Hub.vue';

const routes = [
	{ path: '/', name: 'home', component: () => import('@/pages/Home.vue'), meta: { requiresAuth: true } },
	{ path: '/login', name: 'login', component: () => import('@/pages/Login.vue'), meta: { requiresAuth: false } },
	{
		path: '/register',
		name: 'onboarding',
		component: () => import('@/pages/Onboarding.vue'),
		meta: { requiresAuth: false },
	},
	{ path: '/hub/:name/:roomId?', name: 'hub', component: Hub, meta: { requiresAuth: true } },
	{
		path: '/error',
		name: 'error',
		component: () => import('@/pages/ErrorPage.vue'),
		props: (route: { query: { errorKey: String; errorValues: Array<String | Number> } }) => ({ errorKey: route.query.errorKey || 'errors.general_error', errorValues: route.query.errorValues || [] }),
		meta: { requiresAuth: false },
	},
];
export { routes };
