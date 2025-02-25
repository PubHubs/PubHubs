import Dialog from '../../src/components/ui/Dialog.vue';
import { DialogButton } from '../../src/logic/store/dialog';
import { describe, expect, beforeEach, test, afterEach } from 'vitest';
import { flushPromises, shallowMount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';

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
