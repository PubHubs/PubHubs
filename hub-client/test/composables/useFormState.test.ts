import { describe, expect, test, vi } from 'vitest';

import { useFormState } from '@/composables/useFormState';
const { data, setData, updateData, dataIsChanged, isChanged, message, setMessage } = useFormState();

describe('useFormState', () => {
	test('setData', () => {
		setData({
			aNumber: 3,
			aString: 'test',
		});

		expect(data.aNumber).toBeTypeOf('number');
		expect(data.aNumber).toEqual(3);

		expect(data.aString).toBeTypeOf('string');
		expect(data.aString).toEqual('test');

		expect(dataIsChanged('aNumber')).toEqual(false);
		expect(dataIsChanged('aString')).toEqual(false);

		expect(isChanged()).toEqual(false);
	});

	test('updateData', () => {
		setData({
			aNumber: 3,
			aString: 'test',
		});

		expect(data.aNumber).toEqual(3);
		expect(data.aString).toEqual('test');

		updateData('aNumber', 5);
		expect(data.aNumber).toEqual(5);
		expect(dataIsChanged('aNumber')).toEqual(true);
		expect(dataIsChanged('aString')).toEqual(false);
		expect(isChanged()).toEqual(true);
	});

	test('Message', () => {
		vi.useFakeTimers();

		setMessage('Message');
		expect(message.value).toEqual('Message');

		vi.runAllTimers();
		expect(message.value).toEqual('');
	});
});
