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
		meta: { onboarding: true },
	},
	{
		path: '/onboarding',
		name: 'onboarding',
		component: () => import('@/pages/Onboarding.vue'),
		meta: { hideBar: true },
	},
	{
		path: '/admin',
		name: 'admin',
		component: () => import('@/pages/Admin.vue'),
		meta: { onlyAdmin: true, hideBar: true, onboarding: true },
	},
	{
		path: '/manage-users',
		name: 'manage-users',
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
		path: '/discover-rooms',
		name: 'discover-rooms',
		component: () => import('@/pages/DiscoverRoomsPage.vue'),
		meta: { hideBar: true, onboarding: true },
	},
	{
		path: '/error-page',
		name: 'error-page',
		component: () => import('@/pages/ErrorPage.vue'),
		props: (route: { query: { errorKey: String; errorValues: Array<String | Number> } }) => ({ errorKey: route.query.errorKey || 'errors.general_error', errorValues: route.query.errorValues || [] }),
		meta: { hideBar: true },
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
router.beforeEach((to, from) => {
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
				query: { type: onboardingType, originalRoute: to.path },
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
		return { name: 'home' };
	}
	if (to.name === 'error-page' && from.name === undefined) {
		// Redirect to home if coming from a browser refresh (undefined)
		return { name: 'home' };
	}
	// Default allow navigation
	return true;
});

export { router, routes };
