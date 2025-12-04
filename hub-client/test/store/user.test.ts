// Packages
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test } from 'vitest';

// Stores
import { useUser } from '@hub-client/stores/user';

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
});
