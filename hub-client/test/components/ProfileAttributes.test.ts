// Packages
import { createTestingPinia } from '@pinia/testing';
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { createI18n } from 'vue-i18n';

// Components
import ProfileAttributes from '@hub-client/components/rooms/ProfileAttributes.vue';

import { en } from '@hub-client/locales/en';
import { nl } from '@hub-client/locales/nl';

// Stores
import { useRooms } from '@hub-client/stores/rooms';

describe('ProfileAttributes.vue Test', () => {
	let wrapper;
	let rooms;

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

		wrapper = mount(ProfileAttributes, {
			props: {
				user: 'user',
				room_id: 'room',
			},
			global: {
				plugins: [i18n, createTestingPinia()],
			},
		});

		rooms = useRooms();
	});

	afterEach(() => {
		wrapper.unmount();
	});

	test('badges correctly updated', async () => {
		expect(wrapper.text()).toBe('');

		rooms.$patch({
			roomNotices: {
				room: {
					user: ['an attr', 'another attr'],
					another_user: ['some other attribute'],
				},
			},
		});

		await flushPromises();

		expect(wrapper.text().replace(/\s+/g, ' ').trim()).toBe('an attranother attr');
	});

	test('admin badges', async () => {
		rooms.$patch({
			roomNotices: {
				room: {
					user: ['admin.title_administrator'],
				},
			},
		});

		await flushPromises();

		expect(wrapper.text()).toBe('Administrator');
	});
});
