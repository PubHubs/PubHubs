import { setActivePinia, createPinia } from 'pinia';
import { describe, beforeEach, assert, expect, test } from 'vitest';
import { useUser } from '@/store/user';

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
	});

	describe('user', () => {
		test('default', () => {
			expect(user.user).toBeTypeOf('object');
		});

		test('setUser', () => {
			user.setUser({ userId: 'test' });
			expect(user.user).toHaveProperty('userId');
			expect(user.user.userId).toEqual('test');
		});

		test('isLoggedIn', () => {
			expect(user.isLoggedIn).toEqual(false);
			user.setUser({ userId: 'test' });
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
