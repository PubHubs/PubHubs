// Packages
import { flushPromises, shallowMount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

// Components
import InRoomNotifyMarker from '@hub-client/components/ui/InRoomNotifyMarker.vue';

describe('InRoomNotifyMarker.vue Test', () => {
	// Test variables
	let wrapper;
	// SETUP - run before to each unit test
	beforeEach(() => {
		setActivePinia(createPinia());
		wrapper = shallowMount(InRoomNotifyMarker, {
			data: function () {
				return {
					totalUnreadCount: 0,
					totalMentionCount: 0,
				};
			},
		});
	});
	// TEARDOWN - run after to each unit test
	afterEach(() => {
		wrapper.unmount();
	});

	test('test html rendering on InRoomNotifyMarker', async () => {
		wrapper.vm.totalUnreadCount = 1;
		wrapper.vm.totalMentionCount = 1;
		await flushPromises();
		expect(wrapper.findAll('div').length).toBe(5);
		expect(wrapper.findAllComponents({ name: 'Icon' }).length).toBe(2);
	});
	test('test total message count', async () => {
		wrapper.vm.totalUnreadCount = 1;
		await flushPromises();
		expect(wrapper.find('.total').text()).toEqual('1');
	});

	test('test total mention count', async () => {
		wrapper.vm.totalMentionCount = 1;
		await flushPromises();
		expect(wrapper.find('.mention').text()).toEqual('1');
	});
});
