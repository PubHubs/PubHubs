import { describe, expect, test, vi } from 'vitest';

import { useFormState } from '@/composables/useFormState';
const { data, setData, updateData, dataIsChanged, isChanged, isValidated, message, setMessage } = useFormState();

describe('useFormState', () => {
	test('setData', () => {
		setData({
			aNumber: { value: 3 },
			aString: { value: 'test' },
		});

		expect(data.aNumber.value).toBeTypeOf('number');
		expect(data.aNumber.value).toEqual(3);

		expect(data.aString.value).toBeTypeOf('string');
		expect(data.aString.value).toEqual('test');

		expect(dataIsChanged('aNumber')).toEqual(false);
		expect(dataIsChanged('aString')).toEqual(false);

		expect(isChanged()).toEqual(false);
	});

	test('updateData', () => {
		setData({
			aNumber: { value: 3 },
			aString: { value: 'test' },
		});

		expect(data.aNumber.value).toEqual(3);
		expect(data.aString.value).toEqual('test');

		updateData('aNumber', 5);
		expect(data.aNumber.value).toEqual(5);
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

	test('Validation', () => {
		setData({
			aNumber: { value: '', validation: { required: true } },
			aString: { value: '', validation: { required: true } },
		});

		expect(isValidated()).toEqual(false);

		updateData('aNumber', 5);
		expect(isValidated()).toEqual(false);
		updateData('aString', 'test');
		expect(isValidated()).toEqual(true);
		updateData('aNumber', 0);
		expect(isValidated()).toEqual(true);
		updateData('aString', '');
		expect(isValidated()).toEqual(false);
	});
});
