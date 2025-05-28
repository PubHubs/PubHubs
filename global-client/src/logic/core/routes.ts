import Hub from '@/pages/Hub.vue';

const routes = [
	{ path: '/', name: 'home', component: () => import('@/pages/Home.vue') },
	{
		path: '/register',
		name: 'onboarding',
		component: () => import('@/pages/Onboarding.vue'),
	},
	{ path: '/hub/:name/:roomId?', name: 'hub', component: Hub },
];
export { routes };
