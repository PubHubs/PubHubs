import ReadReceipt from '@/components/ui/ReadReceipt.vue';
import { describe, expect, beforeEach, afterEach } from 'vitest';
import { shallowMount, flushPromises } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { nl } from '@/locales/nl';
import { en } from '@/locales/en';

describe('ReadReceipt.vue Test', () => {
	let wrapper;
	let i18n;
	const fallbackLanguage = 'en';

	// SETUP - run before to each unit test
	beforeEach(() => {
		setActivePinia(createPinia());

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
			(wrapper = shallowMount(ReadReceipt, {
				global: { plugins: [i18n] },
				propsData: {
					timestamp: 0,
					sender: '',
				},
				data: function () {
					return { numOfUsersRead: 0 };
				},
			}));
	});
	// TEARDOWN - run after to each unit test
	afterEach(() => {
		wrapper.unmount();
	});

	test('test valid props data', async () => {
		wrapper.setProps({
			timestamp: 1710910556,
			sender: 'b2e-56e',
		});
		// Wait until the DOM updates
		await flushPromises();
		expect(wrapper.vm.timestamp).toEqual(1710910556);
		expect(wrapper.vm.sender).toMatch('b2e-56e');
	});

	test('test component for single user read', async () => {
		wrapper.vm.numOfUsersRead = 1;
		await flushPromises();
		expect(wrapper.find('span').exists()).toBeTruthy();
		expect(wrapper.find('Icon').exists()).toBeTruthy();
		expect(wrapper.findAll('span').length).toBe(1);
		expect(wrapper.findAll('Icon').length).toBe(2);
		expect(wrapper.find('span').text()).toEqual('Read by 1');
		expect(wrapper.find('span').text()).not.includes('+');
	});

	test('test component for two user read', async () => {
		wrapper.vm.numOfUsersRead = 2;
		await flushPromises();
		expect(wrapper.find('span').exists()).toBeTruthy();
		expect(wrapper.find('Icon').exists()).toBeTruthy();
		expect(wrapper.findAll('span').length).toBe(1);
		expect(wrapper.findAll('Icon').length).toBe(2);
		expect(wrapper.find('span').text()).toEqual('Read by 2');
		expect(wrapper.find('span').text()).not.includes('+');
	});

	test('test component for more than two users read', async () => {
		wrapper.vm.numOfUsersRead = 3;
		await flushPromises();
		expect(wrapper.find('span').exists()).toBeTruthy();
		expect(wrapper.find('Icon').exists()).toBeTruthy();
		expect(wrapper.findAll('span').length).toBe(1);
		expect(wrapper.findAll('Icon').length).toBe(2);
		expect(wrapper.find('span').text()).contains('Read by 3');
		expect(wrapper.find('span').text()).includes('+');
	});
});
