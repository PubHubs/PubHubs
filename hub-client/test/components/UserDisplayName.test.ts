import UserDisplayName from '@/components/rooms/UserDisplayName.vue';
import { describe, expect, beforeEach, test } from 'vitest';
import { shallowMount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';

describe('User Display Name.vue Test', () => {
	// Test variables
	let wrapper;
	const nameSelector = '[data-testid=display-name]';
	//let memberFunction: (any) =>  any  =  (user) => user ? '@123-abc:matrix' : null;

	// SETUP - run before to each unit test
	beforeEach(() => {
		setActivePinia(createPinia());
	});
	test('test member is null', async () => {
		// Wait until the DOM updates
		wrapper = shallowMount(UserDisplayName, {
			propsData: {
				user: '@123-abc:matrix',
				room: {
					getMember: (user) => null,
				},
			},
		});

		await flushPromises();
		expect(wrapper.find(nameSelector).exists()).toEqual(false);
	});

	test('test member display name is correct', async () => {
		let room = {
			getMember: (user) => {
				return { rawDisplayName: 'user' };
			},
		};
		wrapper = shallowMount(UserDisplayName, {
			propsData: {
				user: '@123-abc:matrix',
				room: room,
			},
		});

		// Wait until the DOM updates
		await flushPromises();
		expect(wrapper.find(nameSelector).text()).toEqual('user');
		await wrapper.setProps({
			user: '@123-abc:matrix',
			room: {
				getMember: (user) => {
					return { rawDisplayName: 'user2' };
				},
			},
		});
		expect(wrapper.find(nameSelector).text()).toEqual('user2');
	});
});
