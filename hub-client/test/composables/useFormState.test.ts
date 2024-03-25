import { describe, expect, test, vi } from 'vitest';

import { useFormState } from '@/composables/useFormState';
const { data, setData, updateData, dataIsChanged, isChanged, isValidated, message, validationErrors, setMessage } = useFormState();

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

        expect(dataIsChanged()).toEqual(false);
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
        expect(dataIsChanged()).toEqual(true);
		expect(isChanged()).toEqual(true);

        updateData('aString', 'string');
        expect(data.aString.value).toEqual('string');
        expect(dataIsChanged('aNumber')).toEqual(true);
        expect(dataIsChanged('aString')).toEqual(true);
        expect(dataIsChanged()).toEqual(true);
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
			aString: { value: '', validation: { required: true, max_length:10, min_length:2 } },
		});

        // required
		expect(isValidated()).toEqual(false);

        updateData('aString', 'test');

        updateData('aNumber', null);
        expect(isValidated()).toEqual(false);
        expect(validationErrors.value).toHaveProperty('aNumber');
        expect(validationErrors.value.aNumber).toHaveProperty('error');
        expect(validationErrors.value.aNumber.error).toEqual('validation.required');
        updateData('aNumber', 0);
        expect(isValidated()).toEqual(true);
        expect(validationErrors.value).not.toHaveProperty('aNumber');
		updateData('aNumber', 5);
		expect(isValidated()).toEqual(true);
        expect(validationErrors.value).not.toHaveProperty('aNumber');

        // max_length
        updateData('aString', '');
        expect(isValidated()).toEqual(false);
        expect(validationErrors.value).toHaveProperty('aString');
        expect(validationErrors.value.aString).toHaveProperty('error');
        expect(validationErrors.value.aString.error).toEqual('validation.required');

        updateData('aString', 'test');
		expect(isValidated()).toEqual(true);
        expect(validationErrors.value).not.toHaveProperty('aString');
        updateData('aString', 'much to long (10)');
        expect(isValidated()).toEqual(false);
        expect(validationErrors.value).toHaveProperty('aString');
        expect(validationErrors.value.aString).toHaveProperty('error');
        expect(validationErrors.value.aString.error).toEqual('validation.max_length');
        updateData('aString', 'exact (10)');
        expect(isValidated()).toEqual(true);
        expect(validationErrors.value).not.toHaveProperty('aString');
        updateData('aString', 'longer (11)');
        expect(isValidated()).toEqual(false);
        expect(validationErrors.value).toHaveProperty('aString');
        expect(validationErrors.value.aString).toHaveProperty('error');
        expect(validationErrors.value.aString.error).toEqual('validation.max_length');
        updateData('aString', '034676295498732845782374598732059823745');
        expect(isValidated()).toEqual(false);
        expect(validationErrors.value).toHaveProperty('aString');
        expect(validationErrors.value.aString).toHaveProperty('error');
        expect(validationErrors.value.aString.error).toEqual('validation.max_length');


        // min_length
        updateData('aString', '');
        expect(isValidated()).toEqual(false);
        expect(validationErrors.value).toHaveProperty('aString');
        expect(validationErrors.value.aString).toHaveProperty('error');
        expect(validationErrors.value.aString.error).toEqual('validation.required');
        updateData('aString', '1');
        expect(isValidated()).toEqual(false);
        expect(validationErrors.value).toHaveProperty('aString');
        expect(validationErrors.value.aString).toHaveProperty('error');
        expect(validationErrors.value.aString.error).toEqual('validation.min_length');
        updateData('aString', '12');
        expect(isValidated()).toEqual(true);
        expect(validationErrors.value).not.toHaveProperty('aString');


	});
});

test('Validation No Validation Messages', () => {

    setData({
        aNumber: { value: '', validation: { required: true }, show_validation: {required:false} },
        aString: { value: '', validation: { required: true, max_length:10, min_length:2 }, show_validation: {required:false, max_length:false, min_length:false } },
    });

    // required
    expect(isValidated()).toEqual(false);

    updateData('aString', 'test');

    updateData('aNumber', null);
    expect(isValidated()).toEqual(false);
    expect(validationErrors.value).not.toHaveProperty('aNumber');

    // max_length
    updateData('aString', '');
    expect(isValidated()).toEqual(false);
    expect(validationErrors.value).not.toHaveProperty('aString');

    updateData('aString', 'much to long (10)');
    expect(isValidated()).toEqual(false);
    expect(validationErrors.value).not.toHaveProperty('aString');
    updateData('aString', 'longer (11)');
    expect(isValidated()).toEqual(false);
    expect(validationErrors.value).not.toHaveProperty('aString');

    // min_length
    updateData('aString', '');
    expect(isValidated()).toEqual(false);
    expect(validationErrors.value).not.toHaveProperty('aString');
    updateData('aString', '1');
    expect(isValidated()).toEqual(false);
    expect(validationErrors.value).not.toHaveProperty('aString');
});
