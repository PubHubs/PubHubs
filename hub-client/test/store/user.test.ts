// Packages
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';

// Stores
import { useUser } from '@hub-client/stores/user';

const getAuthorizedMediaUrl = vi.hoisted(() => vi.fn());
const storage = vi.hoisted(() => new Map<string, unknown>());

vi.mock('@hub-client/composables/useMatrixFiles', () => ({
	useMatrixFiles: () => ({ getAuthorizedMediaUrl }),
}));

vi.mock('@hub-client/logic/core/hubStorage', () => ({
	hubStorage: {
		get: async (key: string) => storage.get(key),
		set: async (key: string, value: unknown) => void storage.set(key, value),
	},
}));

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((r) => (resolve = r));
	return { promise, resolve };
}

// A sliding sync room with a join event for each of the given profiles
function roomData(...members: { sender: string; displayname?: string | null; avatar_url?: string | null }[]) {
	return {
		required_state: members.map(({ sender, ...content }) => ({
			type: 'm.room.member',
			sender,
			state_key: sender,
			content: { membership: 'join', ...content },
		})),
	} as any;
}

const client = {
	isSynapseAdministrator: () => {
		return true;
	},
};
const clientError = {
	isSynapseAdministrator: () => {
		throw new Error('403');
	},
};

describe('User Store', () => {
	let user = {} as any;

	beforeEach(() => {
		setActivePinia(createPinia());
		user = useUser();
		user.setClient({
			getUser: (userId) => (userId === 'test' ? { userId: userId } : undefined),
		});
	});

	describe('user', () => {
		test('setUserId', () => {
			user.setUserId('test');
			expect(user.userId).toEqual('test');
		});

		test('isLoggedIn', () => {
			expect(user.isLoggedIn).toEqual(false);
			user.setUserId('test');
			expect(user.isLoggedIn).toEqual(true);
		});

		test('isAdmin', async () => {
			expect(user.isAdmin).toEqual(false);
			await user.fetchIsAdministrator(client);
			expect(user.isAdmin).toEqual(true);
			await user.fetchIsAdministrator(clientError);
			expect(user.isAdmin).toEqual(false);
		});
	});

	describe('profiles', () => {
		const alice = '@alice:hub';

		beforeEach(() => {
			storage.clear();
			getAuthorizedMediaUrl.mockReset();
			getAuthorizedMediaUrl.mockImplementation(async (url: string) => `authorized:${url}`);
		});

		test('a name change keeps the avatar', async () => {
			await user.loadFromSlidingSync(roomData({ sender: alice, displayname: 'Alice', avatar_url: 'mxc://a' }));
			await user.loadFromSlidingSync(roomData({ sender: alice, displayname: 'Alicia', avatar_url: 'mxc://a' }));
			expect(user.usersProfile.get(alice)).toEqual({ displayName: 'Alicia', avatarUrl: 'authorized:mxc://a', contentAvatarUrl: 'mxc://a' });
		});

		test('an avatar change keeps the name', async () => {
			await user.loadFromSlidingSync(roomData({ sender: alice, displayname: 'Alice', avatar_url: 'mxc://a' }));
			await user.loadFromSlidingSync(roomData({ sender: alice, displayname: 'Alice', avatar_url: 'mxc://b' }));
			expect(user.usersProfile.get(alice)).toEqual({ displayName: 'Alice', avatarUrl: 'authorized:mxc://b', contentAvatarUrl: 'mxc://b' });
		});

		test('the same change arriving from several rooms does not download the unchanged avatar again', async () => {
			await user.loadFromSlidingSync(roomData({ sender: alice, displayname: 'Alice', avatar_url: 'mxc://a' }));
			getAuthorizedMediaUrl.mockClear();
			const room1 = user.loadFromSlidingSync(roomData({ sender: alice, displayname: undefined, avatar_url: 'mxc://a' }));
			const room2 = user.loadFromSlidingSync(roomData({ sender: alice, displayname: undefined, avatar_url: 'mxc://a' }));
			await Promise.all([room1, room2]);
			await user.loadFromSlidingSync(roomData({ sender: alice, displayname: 'Alice', avatar_url: 'mxc://a' }));
			await user.loadFromSlidingSync(roomData({ sender: alice, displayname: 'Alice', avatar_url: 'mxc://a' }));
			expect(getAuthorizedMediaUrl).not.toHaveBeenCalled();
			expect(user.usersProfile.get(alice)).toEqual({ displayName: 'Alice', avatarUrl: 'authorized:mxc://a', contentAvatarUrl: 'mxc://a' });
		});

		test('updates land in order, even when an older download finishes last', async () => {
			const first = deferred<string>();
			const second = deferred<string>();
			getAuthorizedMediaUrl.mockImplementation((url: string) => (url === 'mxc://a' ? first.promise : second.promise));
			const update1 = user.loadFromSlidingSync(roomData({ sender: alice, displayname: 'Alice', avatar_url: 'mxc://a' }));
			const update2 = user.loadFromSlidingSync(roomData({ sender: alice, displayname: 'Alice', avatar_url: 'mxc://b' }));
			second.resolve('authorized:mxc://b');
			first.resolve('authorized:mxc://a');
			await Promise.all([update1, update2]);
			expect(user.usersProfile.get(alice)).toEqual({ displayName: 'Alice', avatarUrl: 'authorized:mxc://b', contentAvatarUrl: 'mxc://b' });
		});

		test('an empty name or avatar is the same whether it is empty, null or missing', async () => {
			await user.loadFromSlidingSync(roomData({ sender: alice, displayname: '', avatar_url: '' }));
			const before = user.usersProfile.get(alice);
			await user.loadFromSlidingSync(roomData({ sender: alice, displayname: null, avatar_url: null }));
			await user.loadFromSlidingSync(roomData({ sender: alice }));
			expect(getAuthorizedMediaUrl).not.toHaveBeenCalled();
			expect(user.usersProfile.get(alice)).toBe(before);
			expect(before).toEqual({ displayName: undefined, avatarUrl: undefined, contentAvatarUrl: undefined });
		});

		test('removing the avatar clears it without downloading anything', async () => {
			user.setClient({ setAvatarUrl: async () => ({}) });
			user.setUserId(alice);
			await user.loadFromSlidingSync(roomData({ sender: alice, displayname: 'Alice', avatar_url: 'mxc://a' }));
			getAuthorizedMediaUrl.mockClear();
			await user.setAvatarUrl('');
			expect(getAuthorizedMediaUrl).not.toHaveBeenCalled();
			expect(user.usersProfile.get(alice)).toEqual({ displayName: 'Alice', avatarUrl: undefined, contentAvatarUrl: undefined });
			// The member event that follows has no avatar either: nothing changes.
			await user.loadFromSlidingSync(roomData({ sender: alice, displayname: 'Alice' }));
			expect(user.usersProfile.get(alice)).toEqual({ displayName: 'Alice', avatarUrl: undefined, contentAvatarUrl: undefined });
		});

		test('an own avatar change that a member event brought first is not downloaded again', async () => {
			user.setClient({ setAvatarUrl: async () => ({}) });
			user.setUserId(alice);
			await user.loadFromSlidingSync(roomData({ sender: alice, displayname: 'Alice', avatar_url: 'mxc://b' }));
			getAuthorizedMediaUrl.mockClear();
			await user.setAvatarUrl('mxc://b');
			expect(getAuthorizedMediaUrl).not.toHaveBeenCalled();
			expect(user.usersProfile.get(alice)).toEqual({ displayName: 'Alice', avatarUrl: 'authorized:mxc://b', contentAvatarUrl: 'mxc://b' });
		});

		test('an avatar the server refused is not downloaded and changes nothing', async () => {
			user.setClient({
				setAvatarUrl: async () => {
					throw new Error('refused');
				},
			});
			user.setUserId(alice);
			await user.loadFromSlidingSync(roomData({ sender: alice, displayname: 'Alice', avatar_url: 'mxc://a' }));
			getAuthorizedMediaUrl.mockClear();
			await user.setAvatarUrl('mxc://b');
			expect(getAuthorizedMediaUrl).not.toHaveBeenCalled();
			expect(user.usersProfile.get(alice)).toEqual({ displayName: 'Alice', avatarUrl: 'authorized:mxc://a', contentAvatarUrl: 'mxc://a' });
		});

		test('a name cleared on the server stays cleared after a reload', async () => {
			user.setUserId(alice);
			storage.set('ownProfile', { displayName: 'Alice', contentAvatarUrl: 'mxc://a', avatarDataUrl: 'data:image/png;base64,' });
			await user.restoreOwnProfile();
			expect(user.displayName).toEqual('Alice');
			await user.setProfile({ avatar_url: 'mxc://a' });
			expect(user.usersProfile.get(alice)).toEqual({ displayName: undefined, avatarUrl: 'authorized:mxc://a', contentAvatarUrl: 'mxc://a' });
			await user.setProfile({});
			expect(user.usersProfile.get(alice)).toEqual({ displayName: undefined, avatarUrl: undefined, contentAvatarUrl: undefined });
		});
	});
});
