import Hub from '@/pages/Hub.vue';

const routes = [
	{ path: '/', name: 'home', component: () => import('@/pages/Home.vue') },
	{
		path: '/register/:onboardingStep?',
		name: 'onboarding',
		component: () => import('@/pages/Onboarding.vue'),
		props: (route: { params: { onboardingStep: string } }) => ({
			onboardingStep: route.params.onboardingStep == '' ? undefined : parseInt(route.params.onboardingStep),
		}),
	},
	{ path: '/hub/:id/:roomId?', name: 'hub', component: Hub },
];
export { routes };
