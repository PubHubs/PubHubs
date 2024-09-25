import Avatar from '@/components/ui/Avatar.vue';
import { describe, expect, beforeEach, test } from 'vitest';
import { shallowMount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';

describe('Avatar.vue Test', () => {
	// Test variables
	let wrapper;
	const nameSelector = '[data-testid=avatar]';

	// SETUP - run before to each unit test
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	test('test for img src when no room prop is passed', async () => {
		// Wait until the DOM updates
		wrapper = shallowMount(Avatar, {
			propsData: {
				userId: '@123-abc:matrix',
				img: 'mxc://img/prop',
				room: undefined,
			},
		});

		await flushPromises();
		expect(wrapper.find(nameSelector).exists()).toEqual(true);
		expect(wrapper.find('img').attributes('src')).toBe('http://test/_matrix/media/r0/download/img/prop');
	});

	test('test img src when room prop is passed', async () => {
		let room = {
			getMember: (user) => {
				return {
					getMxcAvatarUrl: () => {
						return 'mxc://room/prop';
					},
				};
			},
		};

		// Wait until the DOM updates
		wrapper = shallowMount(Avatar, {
			propsData: {
				userId: '@123-abc:matrix',
				img: 'mxc:/img/prop',
				room: room,
			},
		});

		await flushPromises();
		expect(wrapper.find(nameSelector).exists()).toEqual(true);
		expect(wrapper.find('img').attributes('src')).toBe('http://test/_matrix/media/r0/download/room/prop');
	});

	test('test when img props is empty ', async () => {
		let room = {
			getMember: (user) => {
				return {
					getMxcAvatarUrl: () => {
						return 'mxc://room/prop';
					},
				};
			},
		};
		// Wait until the DOM updates
		wrapper = shallowMount(Avatar, {
			propsData: {
				userId: '@123-abc:matrix',
				img: '',
				room: undefined,
			},
		});
		await flushPromises();
		expect(wrapper.find(nameSelector).exists()).toEqual(false);
		expect(wrapper.find('icon').exists()).toEqual(true);
	});
});
