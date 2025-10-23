// Packages
import { mount } from '@vue/test-utils';
import { expect, test } from 'vitest';

// Components
import Json from '@hub-client/components/elements/Json.vue';

test('mount component', async () => {
	expect(Json).toBeTruthy();

	const wrapper = mount(Json, {
		props: {
			json: { test: 'test' },
		},
	});

	expect(wrapper.text()).toContain('{\n  "test": "test"\n}');
});
