import { describe, expect, test, vi } from 'vitest';

import { createPinia, setActivePinia } from 'pinia';
import { TimeFormat } from '@/logic/store/settings';
import { useTimeFormat } from '../../src/logic/composables/useTimeFormat';
const { formatDate, formatTimestamp } = useTimeFormat();

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: vi.fn((key, params) => {
			if (key === 'time.today') return 'Today';
			if (key === 'time.yesterday') return 'Yesterday';
			if (key === 'time.daysago') return `${params[0]} days ago`;
			return key;
		}),
		d: vi.fn((date, format) => {
			// Basic mock for d for 'short' format
			if (format === 'short') {
				return date.toLocaleDateString(); // Or any other desired mock date format
			}
			return '';
		}),
	}),
}));

describe('useTimeFormat', () => {
	test('formatDate', () => {
		setActivePinia(createPinia());

		let time = formatDate(new Date('2020-12-31T03:24:00'), TimeFormat.format12);
		expect(time).toEqual('3:24 AM');

		time = formatDate(new Date('2020-12-31T15:24:00'), TimeFormat.format12);
		expect(time).toEqual('3:24 PM');

		time = formatDate(new Date('2020-12-31T03:24:00'), TimeFormat.format24);
		expect(time).toEqual('3:24');

		time = formatDate(new Date('2020-12-31T15:24:00'), TimeFormat.format24);
		expect(time).toEqual('15:24');

		// 12:00 PM
		time = formatDate(new Date('2020-12-31T00:24:00'), TimeFormat.format12);
		expect(time).toEqual('0:24 AM');

		time = formatDate(new Date('2020-12-31T12:24:00'), TimeFormat.format12);
		expect(time).toEqual('12:24 PM');

		time = formatDate(new Date('2020-12-31T00:24:00'), TimeFormat.format24);
		expect(time).toEqual('0:24');

		time = formatDate(new Date('2020-12-31T12:24:00'), TimeFormat.format24);
		expect(time).toEqual('12:24');
	});

	test('formatTimeStamp', () => {
		setActivePinia(createPinia());

		let time = formatTimestamp(new Date('2020-12-31T03:24:00').getTime(), TimeFormat.format12);
		expect(time).toEqual('3:24 AM');

		time = formatTimestamp(new Date('2020-12-31T15:24:00').getTime(), TimeFormat.format12);
		expect(time).toEqual('3:24 PM');

		time = formatTimestamp(new Date('2020-12-31T03:24:00').getTime(), TimeFormat.format24);
		expect(time).toEqual('3:24');

		time = formatTimestamp(new Date('2020-12-31T15:24:00').getTime(), TimeFormat.format24);
		expect(time).toEqual('15:24');
	});
});
