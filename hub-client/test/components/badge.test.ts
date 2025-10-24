// Packages
import { mount } from '@vue/test-utils';
import { expect, test } from 'vitest';

// Components
import Badge from '@hub-client/components/elements/Badge.vue';

test('mount component', async () => {
	expect(Badge).toBeTruthy();
	const wrapper = mount(Badge, {
		slots: {
			default: '99',
		},
	});

	expect(wrapper.text()).toBe('99');
});
