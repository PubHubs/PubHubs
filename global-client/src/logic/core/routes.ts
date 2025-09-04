import Hub from '@/pages/Hub.vue';

const routes = [
	{ path: '/', name: 'home', component: () => import('@/pages/Home.vue') },
	{
		path: '/register',
		name: 'onboarding',
		component: () => import('@/pages/Onboarding.vue'),
	},
	{ path: '/hub/:name/:roomId?', name: 'hub', component: Hub },
	{
		path: '/error',
		name: 'error',
		component: () => import('@/pages/ErrorPage.vue'),
		props: (route: { query: { errorKey: String; errorValues: Array<String | Number> } }) => ({ errorKey: route.query.errorKey || 'errors.general_error', errorValues: route.query.errorValues || [] }),
	},
];
export { routes };
