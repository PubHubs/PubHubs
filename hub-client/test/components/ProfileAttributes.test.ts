import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

import ProfileAttributes from '@/components/rooms/ProfileAttributes.vue';
import { createI18n } from 'vue-i18n';
import { createTestingPinia } from '@pinia/testing';
import { en } from '../../src/locales/en';
import { nl } from '../../src/locales/nl';
import { useRooms } from '@/logic/store/store';

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
					user: ['rooms.admin_badge'],
				},
			},
		});

		await flushPromises();

		expect(wrapper.text()).toBe('Admin');
	});
});
