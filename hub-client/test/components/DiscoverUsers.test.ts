import DiscoverUsers from '../../src/components/rooms/DiscoverUsers.vue';
import FilteredList from '../../src/components/ui/FilteredList.vue';
import TextInput from '../../src/components/forms/TextInput.vue';
import { usePubHubs } from '../../src/core/pubhubsStore';
import { describe, expect, beforeEach, test, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';

const foundDisplayName = '[data-testid=display-name]';
const foundUserId = '[data-testid=user-id]';

describe('DiscoverUsers.vue Test', () => {
	let wrapper;
	let pubhubs;

	beforeEach(() => {
		wrapper = mount(DiscoverUsers, {
			global: {
				components: { FilteredList: FilteredList, TextInput: TextInput },
				plugins: [createTestingPinia({ stubActions: false })],
				mocks: {
					$t: (_) => 'translation',
				},
			},
		});

		pubhubs = usePubHubs();
	});

	afterEach(() => {
		wrapper.unmount();
	});

	test('Test user displayed', async () => {
		//Mock function results
		pubhubs.findUsers.mockResolvedValue([]);

		await flushPromises();

		expect(() => wrapper.get(foundUserId)).toThrow(/Unable to get/);
		expect(() => wrapper.get(foundDisplayName)).toThrow(/Unable to get/);

		// Notice no utf-8 character testing. Synapse search does not seem to handle well.
		pubhubs.findUsers.mockResolvedValue([
			{ user_id: '@abc-123:someserver', display_name: 'displayname' },
			{ user_id: '@def-123:ab', display_name: 'displayname2' },
			{ user_id: '@def-abc:someserver', display_name: 'displayname3' },
		]);

		await wrapper.get('[data-test="textinput"]').setValue('ab');

		let userIds = wrapper.findAll(foundUserId);
		// Filter matches based on server name, and matching start of result.
		expect(userIds.length).toEqual(1);

		expect(userIds[0].text()).toEqual('abc-123');
		let displavNames = wrapper.findAll(foundDisplayName);
		expect(displavNames[0].text()).toEqual('displayname');

		pubhubs.findUsers.mockResolvedValue([
			{ user_id: '@abc-123:someserver', display_name: 'displayname' },
			{ user_id: '@fff-123:someserver', display_name: 'Abdisp' },
		]);

		await wrapper.get('[data-test="textinput"]').setValue('ab');

		userIds = wrapper.findAll(foundUserId);
		expect(userIds[0].text()).toEqual('abc-123');
		expect(userIds[1].text()).toEqual('fff-123');
		displavNames = wrapper.findAll(foundDisplayName);
		expect(displavNames[0].text()).toEqual('displayname');
		expect(displavNames[1].text()).toEqual('Abdisp');
	});
});