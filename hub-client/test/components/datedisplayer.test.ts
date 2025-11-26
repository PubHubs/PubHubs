// Packages
import { flushPromises, shallowMount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createI18n } from 'vue-i18n';

// Components
import DateDisplayer from '@hub-client/components/ui/DateDisplayer.vue';

import { en } from '@hub-client/locales/en';
// Locales
import { nl } from '@hub-client/locales/nl';

// Mocking dependencies and Mock useTimeFormat composable
vi.mock('@/composables/useTimeFormat', () => ({
	useTimeFormat: () => ({
		formattedTimeInformation: vi.fn(() => 'Mocked Date'),
	}),
}));

// Mock useRooms composable
vi.mock('@/stores/rooms', () => ({
	useRooms: () => ({
		currentRoom: {
			hasMessages: vi.fn(() => true),
		},
	}),
}));

describe('DateDisplayer.vue Test', () => {
	// Test variables
	let wrapper;
	let i18n;
	const fallbackLanguage = 'en';

	// SETUP - run before to each unit test
	beforeEach(() => {
		setActivePinia(createPinia());

		// Options cloned from main code - see hub-client/src/i18n.ts
		((i18n = createI18n({
			legacy: false,
			warnHtmlMessage: false,
			globalInjection: true,
			locale: fallbackLanguage,
			fallbackLocale: fallbackLanguage,
			messages: {
				nl: nl,
				en: en,
			},
		})),
			(wrapper = shallowMount(DateDisplayer, {
				global: { plugins: [i18n] },
				propsData: {
					eventTimeStamp: 0,
					scrollStatus: true,
				},
			})));
	});
	// TEARDOWN - run after to each unit test
	afterEach(() => {
		wrapper.unmount();
	});

	test('test valid props data', async () => {
		wrapper.setProps({
			eventTimeStamp: 1710910556,
			scrollStatus: false,
		});
		// Wait until the DOM updates
		await flushPromises();
		expect(wrapper.vm.eventTimeStamp).toEqual(1710910556);
		expect(wrapper.vm.scrollStatus).toEqual(false);
	});

	// TODO: This needs to be updated to cater the update in the component.

	test('displayDate controls element visibility', async () => {
		// Check if the date is displayed correctly
		wrapper.find('div');
		// expect(wrapper.find('div').exists()).toBeTruthy();
		// expect(wrapper.find('span').exists()).toBeTruthy();

		// Exact number of elements
		// expect(wrapper.findAll('div').length).toBe(1);
		// expect(wrapper.findAll('div').length).toBe(1);
	});
});
