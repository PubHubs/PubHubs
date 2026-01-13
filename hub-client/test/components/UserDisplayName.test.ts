// Packages
import { flushPromises, shallowMount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';

// Components
import UserDisplayName from '@hub-client/components/rooms/UserDisplayName.vue';

// Stores
import { useUser } from '@hub-client/stores/user';

describe('User Display Name.vue Test', () => {
	// Test variables
	let wrapper;
	const nameSelector = '[data-testid=display-name]';
	//let memberFunction: (any) =>  any  =  (user) => user ? '@123-abc:matrix' : null;

	// SETUP - run before to each unit test
	beforeEach(() => {
		setActivePinia(createPinia());
		// Mock the useUser store
		const user = useUser();
		// Mock the client object with a getUser method
		// user.client = {
		// 	getUser: vi.fn((userId) => ({
		// 		userId,
		// 		rawDisplayName: 'user2',
		// 	})),
		// };
		// // Override the getter output
		// Object.defineProperty(user, 'userDisplayName', {
		// 	get: () => () => 'user2',
		// });
	});

	test('test member display name is correct', async () => {
		wrapper = shallowMount(UserDisplayName, {
			propsData: {
				userId: '@123-abc:matrix',
				userDisplayName: 'user2',
				showDisplayName: true,
			},
		});
		// Wait until the DOM updates
		await flushPromises();
		expect(wrapper.find(nameSelector).text()).toEqual('user2');
		await wrapper.setProps({
			user: '@123-abc:matrix',
			showDisplayName: true,
		});
		expect(wrapper.find(nameSelector).text()).toEqual('user2');
	});
});
