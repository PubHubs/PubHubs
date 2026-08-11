// Packages
import { createTestingPinia } from '@pinia/testing';
import { flushPromises, mount } from '@vue/test-utils';
import { EventType, MsgType } from 'matrix-js-sdk';
import { type MSC3575RoomData } from 'matrix-js-sdk/lib/sliding-sync';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createI18n } from 'vue-i18n';

// Components
import RoomBadge from '@hub-client/components/rooms/RoomBadge.vue';

import { en } from '@hub-client/locales/en';
import { nl } from '@hub-client/locales/nl';

// Stores
import { useRooms } from '@hub-client/stores/rooms';

const ROOM_ID = '!room';
const USER = '@alice:test';
const NOTICE_USER = '@notices_user:test';
const BODY = `${USER} joined the room with attributes {'pbdf.sidn-pbdf.surname.familyname': 'Alice'}`;
const BADGE = '[data-testid="event-badges"]';

describe('RoomBadge.vue reactivity', () => {
	let wrapper;
	let rooms: ReturnType<typeof useRooms>;

	beforeEach(() => {
		const i18n = createI18n({
			legacy: false,
			warnHtmlMessage: false,
			globalInjection: true,
			locale: 'en',
			fallbackLocale: 'en',
			messages: { nl, en },
		});

		wrapper = mount(RoomBadge, {
			props: { user: USER, roomId: ROOM_ID },
			global: {
				// stubActions:false so the real addProfileNotice mutates roomNotices.
				plugins: [i18n, createTestingPinia({ stubActions: false })],
			},
		});

		rooms = useRooms();
	});

	afterEach(() => {
		wrapper.unmount();
	});

	test('shows no badge when the user has no disclosed attributes', () => {
		expect(wrapper.find(BADGE).exists()).toBe(false);
	});

	test('renders the badge live when a notice is recorded (no remount)', async () => {
		expect(wrapper.find(BADGE).exists()).toBe(false);

		rooms.addProfileNotice(ROOM_ID, BODY);
		await flushPromises();

		expect(wrapper.find(BADGE).exists()).toBe(true);
		expect(wrapper.find(BADGE).text()).toBe('Alice');
	});

	test('renders the badge live when the notice arrives through sliding sync (no remount)', async () => {
		expect(wrapper.find(BADGE).exists()).toBe(false);

		// Full chain: a live sliding-sync timeline entry flows through loadFromSlidingSync into
		// roomNotices, and the mounted badge updates without being re-created.
		vi.spyOn(rooms, 'getNoticeUserId').mockResolvedValue(NOTICE_USER);

		const roomData = {
			name: '',
			required_state: [],
			timeline: [{ type: EventType.RoomMessage, sender: NOTICE_USER, content: { msgtype: MsgType.Notice, body: BODY } }],
		} as unknown as MSC3575RoomData;

		rooms.loadFromSlidingSync(ROOM_ID, roomData);
		await flushPromises();

		expect(wrapper.find(BADGE).exists()).toBe(true);
		expect(wrapper.find(BADGE).text()).toBe('Alice');
	});
});
