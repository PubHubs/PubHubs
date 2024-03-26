import DateDisplayer from '@/components/ui/DateDisplayer.vue';
import { describe, expect, beforeEach, afterEach, test } from 'vitest';
import { shallowMount, flushPromises } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { nl } from '@/locales/nl';
import { en } from '@/locales/en';

import { setActivePinia, createPinia } from 'pinia';

describe('DateDisplayer.vue Test', () => {
	// Test variables
	let wrapper;
	let i18n;
	const fallbackLanguage = 'en';

	// SETUP - run before to each unit test
	beforeEach(() => {
		setActivePinia(createPinia());

		// Options cloned from main code - see hub-client/src/i18n.ts
		(i18n = createI18n({
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
			}));
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

	test('test html rendering on Date Displayer component', async () => {
		// Existence of html elements in component check
		expect(wrapper.find('div').exists()).toBeTruthy();
		expect(wrapper.find('span').exists()).toBeTruthy();

		// Exact number of element check
		expect(wrapper.findAll('div').length).toBe(1);
		expect(wrapper.findAll('div').length).toBe(1);
		
	});
});
