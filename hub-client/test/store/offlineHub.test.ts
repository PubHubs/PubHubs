// Packages
import { createPinia, setActivePinia } from 'pinia';
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

// Logic
import { api_synapse } from '@hub-client/logic/core/api';
import { hubStorage } from '@hub-client/logic/core/hubStorage';
import { NetworkError } from '@hub-client/logic/core/networkError';
import { router } from '@hub-client/logic/core/router';

// Models
import { type RoomListRoom, RoomType } from '@hub-client/models/rooms/TBaseRoom';

// Stores
import { useHubSettings } from '@hub-client/stores/hub-settings';
import { usePubhubsStore } from '@hub-client/stores/pubhubs';
import { useRooms } from '@hub-client/stores/rooms';
import { useUser } from '@hub-client/stores/user';

// Writes to HubStorage don't hold up their callers; wait until one has landed.
const stored = (key: string, value: unknown) => vi.waitFor(async () => expect(await hubStorage.get(key)).toEqual(value));

const unreachable = () => Promise.reject(new NetworkError('http://testing/_synapse/client/hub/data'));

beforeAll(async () => {
	const records = new Map<string, never>();
	await hubStorage.open(btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))), async () => ({
		get: async (key) => records.get(key),
		put: async (key, value) => void records.set(key, value as never),
		delete: async (key) => void records.delete(key),
		clear: async () => records.clear(),
	}));
});

describe('the hub without its server', () => {
	let push: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		setActivePinia(createPinia());
		vi.restoreAllMocks();
		push = vi.spyOn(router, 'push').mockResolvedValue(undefined);
	});

	// A request the hub's CORS policy blocks fails just like one to an unreachable hub.
	test('without a known consent state, asks for consent', async () => {
		vi.spyOn(api_synapse, 'apiGET').mockImplementation(unreachable);
		const user = useUser();
		expect(await user.fetchIfUserNeedsConsent()).toBe(true);
		expect(user.needsConsent).toBe(true);
		expect(push).toHaveBeenCalledTimes(1);
		expect(push.mock.calls[0][0]).toMatchObject({ name: 'onboarding', query: { type: 'consent' } });
	});

	test('does not send the user to onboarding again from the onboarding page', async () => {
		vi.spyOn(router.currentRoute, 'value', 'get').mockReturnValue({ ...router.currentRoute.value, name: 'onboarding', path: '/onboarding' });
		vi.spyOn(api_synapse, 'apiGET').mockImplementation(unreachable);
		expect(await useUser().fetchIfUserNeedsConsent()).toBe(true);
		expect(push).not.toHaveBeenCalled();
	});

	test('uses the last consent state the hub gave', async () => {
		vi.spyOn(api_synapse, 'apiGET').mockResolvedValueOnce({ needs_consent: true, needs_onboarding: false });
		await useUser().fetchIfUserNeedsConsent();
		await stored('consent', { needsConsent: true, needsOnboarding: false });

		setActivePinia(createPinia());
		push.mockClear();
		vi.spyOn(api_synapse, 'apiGET').mockImplementation(unreachable);
		const user = useUser();
		expect(await user.fetchIfUserNeedsConsent()).toBe(true);
		expect(push).toHaveBeenCalledTimes(1);
		expect(push.mock.calls[0][0]).toMatchObject({ name: 'onboarding', query: { type: 'consent' } });
	});

	test('remembers an accepted consent', async () => {
		vi.spyOn(api_synapse, 'apiPOST').mockResolvedValueOnce(true);
		await useUser().setUserConsentVersion(2);
		await stored('consent', { needsConsent: false, needsOnboarding: false });

		setActivePinia(createPinia());
		vi.spyOn(api_synapse, 'apiGET').mockImplementation(unreachable);
		expect(await useUser().fetchIfUserNeedsConsent()).toBe(false);
		expect(push).not.toHaveBeenCalled();
	});

	test('lets a failed consent save reach the caller', async () => {
		vi.spyOn(api_synapse, 'apiPOST').mockImplementation(unreachable);
		const user = useUser();
		user.needsConsent = true;
		await expect(user.setUserConsentVersion(2)).rejects.toBeInstanceOf(NetworkError);
		expect(user.needsConsent).toBe(true);
	});

	test('still sends the user to the error page when the hub refuses', async () => {
		vi.spyOn(api_synapse, 'apiGET').mockRejectedValue(new Error('M_FORBIDDEN'));
		const user = useUser();
		await user.fetchIfUserNeedsConsent();
		expect(push.mock.calls[0][0]).toEqual({ name: 'error-page' });
	});

	// The hub sidebar shows the user's own name and avatar, which come from the hub server.
	test('shows the last known own profile, avatar included', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/png' } })),
		);
		vi.spyOn(usePubhubsStore(), 'fetchAuthorizedMediaUrl').mockResolvedValue('blob:avatar');
		let user = useUser();
		user.setUserId('@me:testing');
		await user.setProfile({ displayname: 'Me', avatar_url: 'mxc://testing/avatar' });
		await stored('ownProfile', { displayName: 'Me', contentAvatarUrl: 'mxc://testing/avatar', avatarDataUrl: 'data:image/png;base64,AQID' });
		vi.unstubAllGlobals();

		setActivePinia(createPinia());
		user = useUser();
		user.setUserId('@me:testing');
		await user.restoreOwnProfile();
		expect(user.displayName).toBe('Me');
		expect(user.avatarUrl).toBe('data:image/png;base64,AQID');
	});

	// A hub-client starts from nothing each time the user opens its hub, and its rooms only come in with
	// the first sync (or not at all without a connection).
	describe('the room list', () => {
		const listRoom = (roomId: string, name: string, roomType: RoomType): RoomListRoom => ({
			roomId,
			name,
			roomType,
			stateEvents: [],
			isHidden: false,
			unreadState: 'read',
		});

		test('shows the list as last known until the first sync is in', async () => {
			let rooms = useRooms();
			rooms.setRoomsLoaded(true);
			rooms.updateRoomList(listRoom('!general:testing', 'General', RoomType.PH_MESSAGES_DEFAULT));
			rooms.updateRoomList(listRoom('!secure:testing', 'Secure', RoomType.PH_MESSAGES_RESTRICTED));
			await vi.waitFor(async () => expect(await hubStorage.get('roomList')).toHaveLength(2), { timeout: 3000 });

			setActivePinia(createPinia());
			rooms = useRooms();
			await rooms.restoreRoomList();
			expect(rooms.showsStoredRoomList).toBe(true);
			expect(rooms.menuPublicRooms.map((r) => r.name)).toEqual(['General']);
			expect(rooms.menuSecuredRooms.map((r) => r.name)).toEqual(['Secure']);
			// No unread dots from a copy that may be out of date.
			expect(rooms.menuPublicRooms[0].unreadState).toBe('unknown');
			// The list the rest of the app works with only holds what the sync delivered.
			expect(rooms.roomList).toEqual([]);

			rooms.setRoomsLoaded(true);
			expect(rooms.showsStoredRoomList).toBe(false);
			expect(rooms.menuPublicRooms).toEqual([]);
		});

		test('does not keep a list the first sync has not completed', async () => {
			// Let a store planned by an earlier test land first.
			await new Promise((resolve) => setTimeout(resolve, 1500));
			await hubStorage.delete('roomList');
			const rooms = useRooms();
			rooms.updateRoomList(listRoom('!general:testing', 'General', RoomType.PH_MESSAGES_DEFAULT));
			await new Promise((resolve) => setTimeout(resolve, 1500));
			expect(await hubStorage.get('roomList')).toBeUndefined();
		});
	});

	test('shows the hub settings last loaded', async () => {
		const settingsJson = { summary: 's', description: 'Our hub', contact: 'c', consent: 'rules', version: 3 };
		vi.spyOn(api_synapse, 'apiGET').mockResolvedValueOnce(settingsJson);
		await useHubSettings().getHubJSON();
		await stored('hubSettings', settingsJson);

		setActivePinia(createPinia());
		vi.spyOn(api_synapse, 'apiGET').mockImplementation(unreachable);
		const hubSettings = useHubSettings();
		expect(await hubSettings.getHubJSON()).toEqual(settingsJson);
		expect(hubSettings.hubDescription).toBe('Our hub');
		expect(hubSettings.hubConsentVersion).toBe(3);
	});

	test('passes on other errors when loading hub settings', async () => {
		vi.spyOn(api_synapse, 'apiGET').mockRejectedValue(new Error('M_FORBIDDEN'));
		await expect(useHubSettings().getHubJSON()).rejects.toThrow('M_FORBIDDEN');
	});
});
