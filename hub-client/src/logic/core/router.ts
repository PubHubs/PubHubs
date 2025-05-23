// React imports
import { createRouter, createWebHashHistory } from 'vue-router';

// Project imports
import { useMessageBox, Message, MessageType } from '@/logic/store/messagebox';
import { useHubSettings } from '@/logic/store/store';
import { useUser } from '@/logic/store/user';
import { OnboardingType } from '@/model/constants';

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
	{ path: '/admin-contact', name: 'admin-contact', component: () => import('@/pages/Contact.vue'), meta: { hideBar: true, onboarding: true } },

	{
		path: '/error/',
		name: 'error-page',
		component: () => import('@/pages/ErrorPage.vue'),
		props: (route: any) => ({
			errorKey: route.query?.errorKey ? route.query?.errorKey : 'errors.error',
		}),
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

	// Redirect to onboarding only if user is NOT an admin and needs onboarding / consent
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
