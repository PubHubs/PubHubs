import { createRouter, createWebHashHistory } from 'vue-router';
import { useUser } from '@/store/store';

const routes = [
	{ path: '/', name: 'home', component: () => import('@/pages/HomePage.vue'), props: { showPubHubsCentralLoginButton: true } },
	{ path: '/hub', name: 'hubpage', component: () => import('@/pages/HomePage.vue'), props: { showPubHubsCentralLoginButton: false } },
	{ path: '/admin', name: 'admin', component: () => import('@/pages/Admin.vue'), meta: { onlyAdmin: true } },
	{ path: '/ask-disclosure', name: 'ask-disclosure', component: () => import('@/pages/AskDisclosure.vue'), meta: { onlyAdmin: true } },
	{ path: '/room/:id', props: true, name: 'room', component: () => import('@/pages/Room.vue') },
	{ path: '/secureroom/:id', name: 'secure-room', component: () => import('@/pages/SecureRoomPage.vue') },
	{ path: '/roomerror/:id', name: 'error-page-room', component: () => import('@/pages/RoomErrorPage.vue') },
	{ path: '/nop', name: 'nop', component: () => import('@/pages/NotImplemented.vue') },
];

const router = createRouter({
	history: createWebHashHistory(),
	routes: routes,
});

router.beforeEach((to) => {
	if (to.meta.onlyAdmin) {
		const { isAdmin } = useUser();
		if (isAdmin) {
			return true;
		}
		console.log('ONLY FOR ADMINS', isAdmin);
		return false;
	}
	return true;
});

export { routes, router };
