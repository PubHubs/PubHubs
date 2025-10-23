// Packages
import { createTestingPinia } from '@pinia/testing';
import { flushPromises, shallowMount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

// Components
import Dialog from '@hub-client/components/ui/Dialog.vue';

// Stores
import { DialogButton } from '@hub-client/stores/dialog';

describe('Dialog.vue Test', () => {
	let wrapper;
	let aAllowedToSubmitButton;

	beforeEach(() => {
		aAllowedToSubmitButton = new DialogButton('aLabel', 'aColor', 1);
		aAllowedToSubmitButton.enabled = false;
		wrapper = shallowMount(Dialog, {
			global: {
				plugins: [createTestingPinia()],
				mocks: {
					$t: (_) => 'translation',
				},
			},
			propsData: {
				buttons: [aAllowedToSubmitButton],
			},
		});
	});

	afterEach(() => {
		wrapper.unmount();
	});

	test('Submit button and pressing enter key are in sync', async () => {
		await flushPromises();
		await wrapper.trigger('keydown', { key: 'Enter' });

		expect(wrapper.emitted('close')).toBeUndefined();

		aAllowedToSubmitButton.enabled = true;

		await wrapper.trigger('keydown', { key: 'Enter' });

		expect(wrapper.emitted('close')).toHaveLength(1);
		expect(wrapper.emitted('close')).toEqual([[1]]);
	});

	test('Pressing esc closes', async () => {
		await flushPromises();

		expect(wrapper.emitted('close')).toBeUndefined();

		await wrapper.trigger('keydown', { key: 'Escape' });

		expect(wrapper.emitted('close')).toHaveLength(1);
		expect(wrapper.emitted('close')).toHaveProperty([0]);
	});
});
