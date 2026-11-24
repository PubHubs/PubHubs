// Packages
import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';

// Components
import Checkbox from '@hub-client/components/forms/elements/Checkbox.vue';

describe('Checkbox.vue', () => {
	test('renders no label element without a label', () => {
		const wrapper = mount(Checkbox, { props: { modelValue: false } });
		expect(wrapper.find('label').exists()).toBe(false);
	});

	test('a label is shown next to the box', () => {
		const wrapper = mount(Checkbox, { props: { modelValue: false }, slots: { default: 'Select all' } });
		expect(wrapper.find('label').text()).toBe('Select all');
	});
});
