// Project imports
import { Message, MessageType, useMessageBox } from '@/logic/store/messagebox';
// React imports
import { createRouter, createWebHashHistory } from 'vue-router';

import { OnboardingType } from '@/model/constants';
import { useHubSettings } from '@/logic/store/store';
import { useUser } from '@/logic/store/user';

// Route definitions
const routes = [
	{
		path: '/',
		name: 'home',
		component: () => import('@/pages/HomePage.vue'),
		props: { showPubHubsCentralLoginButton: true },
		meta: { onboarding: true },
	},
	{
		path: '/onboarding',
		name: 'onboarding',
		component: () => import('@/pages/Onboarding.vue'),
		meta: { hideBar: true },
	},
	{
		path: '/hub',
		name: 'hubpage',
		component: () => import('@/pages/HomePage.vue'),
		props: { showPubHubsCentralLoginButton: false },
	},
	{
		path: '/admin',
		name: 'admin',
		component: () => import('@/pages/Admin.vue'),
		meta: { onlyAdmin: true, hideBar: true, onboarding: true },
	},
	{
		path: '/manageusers',
		name: 'manageusers',
		component: () => import('@/pages/ManageUsers.vue'),
		meta: { onlyAdmin: true, hideBar: true, onboarding: true },
	},
	{
		path: '/hub-settings',
		name: 'hub-settings',
		component: () => import('@/pages/HubSettings.vue'),
		meta: { onlyAdmin: true, hideBar: true, onboarding: true },
	},
	{
		path: '/ask-disclosure',
		name: 'ask-disclosure',
		component: () => import('@/pages/AskDisclosure.vue'),
		meta: { onlyAdmin: true, onboarding: true },
	},
	{ path: '/direct-msg', name: 'direct-msg', component: () => import('@/pages/DirectMessage.vue'), meta: { hideBar: true, onboarding: true } },
	{
		path: '/room/:id',
		name: 'room',
		props: true,
		component: () => import('@/pages/Room.vue'),
		meta: { hideBar: true, onboarding: true },
	},
	{
		path: '/discoverrooms',
		name: 'discover-rooms',
		component: () => import('@/pages/DiscoverRoomsPage.vue'),
		meta: { hideBar: true, onboarding: true },
	},
	{
		path: '/error',
		name: 'error-page',
		component: () => import('@/pages/ErrorPage.vue'),
		props: (route: { query: { errorKey: String; errorValues: Array<String | Number> } }) => ({ errorKey: route.query.errorKey || 'errors.general_error', errorValues: route.query.errorValues || [] }),
		meta: { hideBar: true },
	},
	{
		path: '/icons',
		name: 'icons',
		component: () => import('@/pages/Icons.vue'),
	},
	{
		path: '/nop',
		name: 'nop',
		component: () => import('@/pages/NotImplemented.vue'),
	},
];

// Create the router instance
const router = createRouter({
	history: createWebHashHistory(),
	routes,
});

// Navigation guard
router.beforeEach((to) => {
	const messagebox = useMessageBox();

	// Notify parent iframe about non-room navigation
	if (!['room', 'error-page-room'].includes(to.name as string)) {
		messagebox.sendMessage(new Message(MessageType.RoomChange, ''));
	}

	// Hide UI bar if specified in route meta
	const hubSettings = useHubSettings();
	if (to.meta.hideBar) {
		hubSettings.hideBar();
	}

	// Redirect to onboarding only if user needs onboarding / consent
	if (to.meta.onboarding) {
		const { needsConsent, needsOnboarding } = useUser();
		if (needsConsent || needsOnboarding) {
			const onboardingType = needsOnboarding ? OnboardingType.full : OnboardingType.consent;
			return {
				name: 'onboarding',
				query: { type: onboardingType },
			};
		}
	}

	// Restrict access to admin-only routes
	if (to.meta.onlyAdmin) {
		const { isAdmin, administrator } = useUser();
		if (isAdmin && administrator) {
			return true;
		}
		console.log('ONLY FOR ADMINS', isAdmin);
		return false;
	}

	// Default allow navigation
	return true;
});

export { router, routes };
