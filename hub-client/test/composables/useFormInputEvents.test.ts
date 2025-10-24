// Packages
import { describe, expect, test } from 'vitest';

// Composables
import { useFormInputEvents } from '@hub-client/composables/useFormInputEvents';

const { setValue, setOptions, selectOption, optionIsSelected } = useFormInputEvents({});

describe('useFormInputEvents', () => {
	const options = [
		{ label: 'testLabel', value: 'test' },
		{ label: 'otherLabel', value: 'other' },
		{ label: 'lastLabel', value: 'last' },
	];

	test('selected', () => {
		setValue('test');
		setOptions(options);

		expect(optionIsSelected(options[0])).toEqual(true);
		expect(optionIsSelected(options[1])).toEqual(false);

		selectOption(options[1]);

		expect(optionIsSelected(options[0])).toEqual(false);
		expect(optionIsSelected(options[1])).toEqual(true);
	});
});
