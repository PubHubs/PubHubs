import { Message, MessageType, useMessageBox } from '@/store/messagebox';
import { useHubSettings } from '@/store/store';
import { useUser } from '@/store/user';
import { createRouter, createWebHashHistory } from 'vue-router';

const routes = [
	{ path: '/', name: 'home', component: () => import('@/pages/HomePage.vue'), props: { showPubHubsCentralLoginButton: true } },
	{ path: '/onboarding', name: 'onboarding', component: () => import('@/pages/Onboarding.vue'), meta: { hideBar: true } },
	{ path: '/hub', name: 'hubpage', component: () => import('@/pages/HomePage.vue'), props: { showPubHubsCentralLoginButton: false } },
	{ path: '/admin', name: 'admin', component: () => import('@/pages/Admin.vue'), meta: { onlyAdmin: true, hideBar: true } },
	{ path: '/ask-disclosure', name: 'ask-disclosure', component: () => import('@/pages/AskDisclosure.vue'), meta: { onlyAdmin: true } },
	{ path: '/room/:id', props: true, name: 'room', component: () => import('@/pages/Room.vue'), meta: { hideBar: true } },
	{ path: '/secureroom/:id', name: 'secure-room', component: () => import('@/pages/SecureRoomPage.vue'), meta: { hideBar: true } },
	{ path: '/roomerror/:id', name: 'error-page-room', component: () => import('@/pages/RoomErrorPage.vue'), meta: { hideBar: true } },
	{ path: '/discoverrooms', name: 'discover-rooms', component: () => import('@/pages/DiscoverRoomsPage.vue'), meta: { hideBar: true } },
	{ path: '/error/', name: 'error-page', component: () => import('@/pages/ErrorPage.vue'), props: (route: any) => ({ errorKey: route.query?.errorKey ? route.query?.errorKey : 'errors.error' }), meta: { hideBar: true } },
	{ path: '/nop', name: 'nop', component: () => import('@/pages/NotImplemented.vue') },
];

const router = createRouter({
	history: createWebHashHistory(),
	routes: routes,
});

router.beforeEach((to) => {
	// since hub-client runs in an iFrame the URL is not updated on router.push.
	// here we check which route is chosen and if necessary change the URL by sending the appopriate message to the global client
	const messagebox = useMessageBox();
	if (to.name !== 'room' && to.name !== 'secure-room' && to.name !== 'error-page-room') {
		messagebox.sendMessage(new Message(MessageType.RoomChange, ''));
	}

	const hubSettings = useHubSettings();
	if (to.meta.hideBar) {
		hubSettings.hideBar();
	}

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

export { router, routes };
