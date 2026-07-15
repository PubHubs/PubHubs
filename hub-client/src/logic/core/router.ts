// Packages
import { EventTimeline, EventType } from 'matrix-js-sdk';
import { createRouter, createWebHashHistory } from 'vue-router';

// Composables
import { useRoles } from '@hub-client/composables/roles.composable';

// Models
import { OnboardingType } from '@hub-client/models/constants';
import { UserRole } from '@hub-client/models/users/TUser';

import { useHubSettings } from '@hub-client/stores/hub-settings';
import { Message, MessageType, useMessageBox } from '@hub-client/stores/messagebox';
import { usePubhubsStore } from '@hub-client/stores/pubhubs';
// Stores
import { useUser } from '@hub-client/stores/user';

// Route definitions
const routes = [
	{
		path: '/',
		name: 'home',
		component: () => import('@hub-client/pages/HomePage.vue'),
		meta: { onboarding: true },
	},
	{
		path: '/onboarding',
		name: 'onboarding',
		component: () => import('@hub-client/pages/Onboarding.vue'),
		meta: { hideBar: true },
	},
	{
		path: '/manage-rooms/:tab?',
		name: 'manage-rooms',
		component: () => import('@hub-client/pages/ManageRooms.vue'),
		props: true,
		meta: { accessFor: [UserRole.Steward, UserRole.SuperSteward, UserRole.Admin], hideBar: true, onboarding: true },
	},
	{
		path: '/admin/edit/:id',
		props: true,
		name: 'editroom',
		component: () => import('@hub-client/pages/EditRoom.vue'),
		meta: { accessFor: [UserRole.Steward, UserRole.SuperSteward, UserRole.Admin], hideBar: true, onboarding: true },
	},
	{
		path: '/manage-users',
		name: 'manage-users',
		component: () => import('@hub-client/pages/ManageUsers.vue'),
		meta: { accessFor: [UserRole.Steward, UserRole.SuperSteward, UserRole.Admin], hideBar: true, onboarding: true },
	},
	{
		path: '/hub-settings',
		name: 'hub-settings',
		component: () => import('@hub-client/pages/HubSettings.vue'),
		meta: { accessFor: [UserRole.Admin], hideBar: true, onboarding: true },
	},
	{
		path: '/direct-msg',
		name: 'direct-msg',
		component: () => import('@hub-client/pages/DirectMessage.vue'),
		meta: { hideBar: true, onboarding: true },
	},
	{
		path: '/room/:id/:topicId?',
		name: 'room',
		props: true,
		component: () => import('@hub-client/pages/Room.vue'),
		meta: { hideBar: true, onboarding: true },
	},
	{
		path: '/discover-rooms',
		name: 'discover-rooms',
		component: () => import('@hub-client/pages/DiscoverRoomsPage.vue'),
		meta: { hideBar: true, onboarding: true },
	},
	{
		path: '/error-page',
		name: 'error-page',
		component: () => import('@hub-client/pages/ErrorPage.vue'),
		props: (route: { query: { errorKey: string; errorValues: Array<string | number>; fromRoute: string } }) => ({
			errorKey: route.query.errorKey || 'errors.general_error',
			errorValues: route.query.errorValues || [],
			fromRoute: route.query.fromRoute || null,
		}),
		meta: { hideBar: true },
	},
	{
		path: '/icons',
		name: 'icons',
		component: () => import('@hub-client/pages/Icons.vue'),
		meta: { hideBar: true, onboarding: true },
	},
	{
		path: '/design',
		name: 'design',
		component: () => import('@hub-client/pages/NewDesign.vue'),
		meta: { hideBar: true, onboarding: true },
	},

	{
		path: '/nop',
		name: 'nop',
		component: () => import('@hub-client/pages/NotImplemented.vue'),
	},
	{ path: '/videocall', name: 'videocall', component: () => import('@hub-client/pages/VideoCallPage.vue') },
];

// Create the router instance
const router = createRouter({
	history: createWebHashHistory(),
	routes,
});

// Navigation guard
router.beforeEach((to, from) => {
	const messagebox = useMessageBox();
	const user = useUser();

	// Notify parent iframe about non-room navigation
	// Send the route name (e.g. non-room navigations such as discover-rooms) so the global-client URL preserves it for refresh.
	// For home, I am sending a empty string to keep the URL clean, the hub-client stays at its default route / which is home
	if (!['room', 'error-page-room'].includes(to.name as string) && from.name !== undefined) {
		const routeName = to.name === 'home' ? '' : (to.name as string);
		messagebox.sendMessage(new Message(MessageType.RoomChange, routeName));
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

	// Restrict access
	if (to.meta.accessFor) {
		const roles = useRoles();
		const accessRoles = to.meta.accessFor as Array<UserRole>;
		// for specific room?
		const roomId = to.params.id ? (to.params.id as string) : undefined;

		if (roomId) {
			if (roles.userHasAccessForRoles(accessRoles, roomId)) {
				return true;
			}
			// Fallback: check the Matrix SDK room directly (rooms from sliding sync may not be in state.rooms)
			const pubhubs = usePubhubsStore();
			const matrixRoom = pubhubs.client?.getRoom(roomId);
			if (matrixRoom) {
				const powerLevelEvent = matrixRoom.getLiveTimeline().getState(EventTimeline.FORWARDS)?.getStateEvents(EventType.RoomPowerLevels, '');
				if (powerLevelEvent) {
					const content = powerLevelEvent.getContent() as { users?: Record<string, number>; users_default?: number };
					const powerLevel = content?.users?.[user.userId ?? ''] ?? content?.users_default ?? 0;
					if (accessRoles.includes(roles.getRoleByPowerLevel(powerLevel))) {
						return true;
					}
				}
			}
		} else {
			// Hub-wide pages (no room context): check hub-wide power level
			const hubRole = roles.getRoleByPowerLevel(roles.userHubPowerLevel());
			if (accessRoles.includes(hubRole)) {
				return true;
			}
			// Allow access while admin status is still loading
			if (!user.adminStatusLoaded) {
				return true;
			}
		}
		// Allow admin-only route while admin status is still loading after login/refresh.
		if (accessRoles.length === 1 && accessRoles[0] === UserRole.Admin && !user.adminStatusLoaded) {
			return true;
		}
		// eslint-disable-next-line no-console -- log navigation errors for debugging
		console.error('ONLY FOR ROUTES: ', to.meta.accessFor, roomId);
		return { name: 'home' };
	}

	// Redirect to home if coming from a browser refresh (undefined)
	if (to.name === 'error-page' && (from.name === undefined || from.name === 'error-page')) {
		return { name: 'home' };
	}
	// Preserve the originating route so the error-page can navigate back to it
	if (to.name === 'error-page' && from.name !== undefined && !to.query.fromRoute) {
		return {
			...to,
			query: { ...to.query, fromRoute: from.fullPath },
		};
	}

	// Default allow navigation
	return true;
});

export { router, routes };
