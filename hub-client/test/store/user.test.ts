import { setActivePinia, createPinia } from 'pinia';
import { describe, beforeEach, assert, expect, test } from 'vitest';
import { useUser } from '@/store/user';

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
	});
});
