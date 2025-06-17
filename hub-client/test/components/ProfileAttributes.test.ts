import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { useRooms } from '@/logic/store/store';
import ProfileAttributes from '@/components/rooms/ProfileAttributes.vue';
import { createI18n } from 'vue-i18n';
import { nl } from '../../src/locales/nl';
import { en } from '../../src/locales/en';

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

		expect(wrapper.text().replace(/\s+/g, ' ').trim()).toBe('an attr another attr');
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
