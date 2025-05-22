import { Message, MessageType, useMessageBox } from '@/logic/store/messagebox';
import { useHubSettings } from '@/logic/store/store';
import { useUser } from '@/logic/store/user';
import { createRouter, createWebHashHistory } from 'vue-router';

const routes = [
	{ path: '/', name: 'home', component: () => import('@/pages/HomePage.vue'), props: { showPubHubsCentralLoginButton: true } },
	{ path: '/onboarding', name: 'onboarding', component: () => import('@/pages/Onboarding.vue'), meta: { hideBar: true } },
	{ path: '/hub', name: 'hubpage', component: () => import('@/pages/HomePage.vue'), props: { showPubHubsCentralLoginButton: false } },
	{ path: '/admin', name: 'admin', component: () => import('@/pages/Admin.vue'), meta: { onlyAdmin: true, hideBar: true } },
	{ path: '/manageusers', name: 'manageusers', component: () => import('@/pages/ManageUsers.vue'), meta: { onlyAdmin: true, hideBar: true } },
	{ path: '/hub-settings', name: 'hub-settings', component: () => import('@/pages/HubSettings.vue'), meta: { onlyAdmin: true, hideBar: true } },
	{ path: '/ask-disclosure', name: 'ask-disclosure', component: () => import('@/pages/AskDisclosure.vue'), meta: { onlyAdmin: true } },
	{ path: '/room/:id', props: true, name: 'room', component: () => import('@/pages/Room.vue'), meta: { hideBar: true } },
	{ path: '/discoverrooms', name: 'discover-rooms', component: () => import('@/pages/DiscoverRoomsPage.vue'), meta: { hideBar: true } },
	{ path: '/admin-contact', name: 'admin-contact', component: () => import('@/pages/Contact.vue'), meta: { hideBar: true } },
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
		const { isAdmin, administrator } = useUser();
		// There should be a valid admin object created when administrator flag is true.
		if (isAdmin && administrator) {
			return true;
		}
		console.log('ONLY FOR ADMINS', isAdmin);
		return false;
	}

	return true;
});

export { router, routes };
