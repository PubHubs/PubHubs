// Packages
import { createTestingPinia } from '@pinia/testing';
import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, test, vi } from 'vitest';
import { createRouter, createWebHistory } from 'vue-router';

// Logic
import { routes } from '@hub-client/logic/core/router';

// Pages
import Room from '@hub-client/pages/Room.vue';

// Stores
import { usePubhubsStore } from '@hub-client/stores/pubhubs';
import { useRooms } from '@hub-client/stores/rooms';
import { useUser } from '@hub-client/stores/user';

// Logic
import { setUpi18n } from '@hub-client/i18n';

describe('Room.vue Test', () => {
	test('room cannot be found redirects to error page', async () => {
		const router = createRouter({
			history: createWebHistory(),
			routes: routes,
		});
		let pushed: { name: string; query: { errorKey: string } } | null = null;

		// Override router push method to test it.
		router.push = vi.fn((p: unknown) => {
			pushed = p as { name: string; query: { errorKey: string } };
			return Promise.resolve();
		});

		const i18n = setUpi18n();

		const pinia = createTestingPinia({
			createSpy: vi.fn,
			stubActions: false,
		});

		// Set up stores to simulate room not found scenario
		const rooms = useRooms(pinia);
		const pubhubs = usePubhubsStore(pinia);
		const user = useUser(pinia);
		user.administrator = new (await import('@hub-client/models/hubmanagement/models/admin')).Administrator();

		// Mark initial rooms as loaded so waitForInitialRoomsLoaded() resolves
		rooms.initialRoomsLoaded = true;

		// User is not a member of the room
		pubhubs.isUserRoomMember = vi.fn().mockResolvedValue(false);

		// Room is not a secured room
		rooms.publicRoomIsSecure = vi.fn().mockReturnValue(false);

		// joinRoom throws because room doesn't exist
		pubhubs.joinRoom = vi.fn().mockRejectedValue(new Error('Room not found'));

		mount(Room, {
			global: {
				plugins: [pinia, router, i18n],
			},
			props: {
				id: '!some_room:some.server',
			},
		});

		// Wait for all async operations to complete
		await flushPromises();

		expect(pushed).not.toBeNull();
		expect(pushed!.name).toEqual('error-page');
		expect(pushed!.query.errorKey).toEqual('errors.cant_find_room');
	});
});
