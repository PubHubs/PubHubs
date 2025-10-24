// Packages
import { createTestingPinia } from '@pinia/testing';
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { createI18n } from 'vue-i18n';

import TextInput from '@hub-client/components/forms/TextInput.vue';
// Components
import DiscoverUsers from '@hub-client/components/rooms/DiscoverUsers.vue';
import FilteredList from '@hub-client/components/ui/FilteredList.vue';

// Locales
import { en } from '@hub-client/locales/en';
import { nl } from '@hub-client/locales/nl';

import { usePubhubsStore } from '@hub-client/stores/pubhubs';
// Stores
import { useUser } from '@hub-client/stores/user';

const foundDisplayName = '[data-testid=display-name]';
const foundUserId = '[data-testid=user-id]';

describe('DiscoverUsers.vue Test', () => {
	let wrapper;
	let pubhubs;

	beforeEach(() => {
		const fallbackLanguage = 'en';
		const i18n = createI18n({
			legacy: false,
			warnHtmlMessage: false,
			globalInjection: true,
			locale: fallbackLanguage,
			fallbackLocale: fallbackLanguage,
			messages: {
				nl: nl,
				en: en,
			},
		});
		wrapper = mount(DiscoverUsers, {
			global: {
				components: { FilteredList: FilteredList, TextInput: TextInput },
				plugins: [createTestingPinia({ stubActions: false }), i18n],

				mocks: {
					$t: (_) => 'translation',
				},
			},
		});
		const user = useUser();
		user.setClient({
			getUser: (userId) => {
				return { userId: userId };
			},
		});

		pubhubs = usePubhubsStore();
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
