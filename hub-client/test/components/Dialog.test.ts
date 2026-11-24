// Packages
import { createTestingPinia } from '@pinia/testing';
import { flushPromises, shallowMount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Components
import Dialog from '@hub-client/components/ui/Dialog.vue';

// Stores
import { DialogButton, DialogCancel, DialogOk, useDialog } from '@hub-client/stores/dialog';

const pressEscape = async () => {
	// Esc is handled by a global listener so it works regardless of where focus is
	document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
	await flushPromises();
};

describe('Dialog.vue Test', () => {
	let pinia;
	let wrapper;
	let aAllowedToSubmitButton;

	const mountDialog = (props = {}) =>
		shallowMount(Dialog, {
			global: {
				plugins: [pinia],
				mocks: {
					$t: (_) => 'translation',
				},
			},
			props,
		});

	beforeEach(() => {
		pinia = createTestingPinia({ stubActions: false });
		aAllowedToSubmitButton = new DialogButton('aLabel', 'aColor', 1);
		aAllowedToSubmitButton.enabled = false;
		wrapper = mountDialog({ buttons: [aAllowedToSubmitButton] });
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

		await pressEscape();

		expect(wrapper.emitted('close')).toHaveLength(1);
		expect(wrapper.emitted('close')).toHaveProperty([0]);
	});

	describe('with a dialog opened on top', () => {
		test('Opening a component dialog on top of another one is reported', () => {
			const error = vi.spyOn(console, 'error').mockImplementation(() => {});

			const top = mountDialog();

			expect(error).toHaveBeenCalledOnce();
			top.unmount();
			error.mockRestore();
		});

		test('A store dialog is refused while another dialog is open', async () => {
			const error = vi.spyOn(console, 'error').mockImplementation(() => {});
			const dialog = useDialog();

			await expect(dialog.okcancel('Sure?')).resolves.toBe(DialogCancel);

			expect(dialog.entry).toBeNull();
			expect(error).toHaveBeenCalledOnce();
			error.mockRestore();
		});

		test('A store dialog opens once the component dialog has closed', async () => {
			const dialog = useDialog();
			const answer = vi.fn();

			wrapper.unmount();
			dialog.okcancel('Sure?').then(answer);
			dialog.close(dialog.entry!.id, DialogOk);
			await flushPromises();

			expect(answer).toHaveBeenCalledWith(DialogOk);
			// Mounted again so afterEach has something to unmount
			wrapper = mountDialog();
		});
	});
});

describe('dialog store', () => {
	beforeEach(() => {
		createTestingPinia({ stubActions: false });
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	test("The parent frame's modal stays up until the last holder lets go", () => {
		const dialog = useDialog();
		const sendModal = vi.spyOn(dialog, 'sendModal').mockImplementation(() => {});
		// The image lightbox holds the modal without being a dialog
		const lightbox = dialog.newId();

		const id = dialog.register();
		dialog.holdModal(lightbox);
		expect(sendModal).toHaveBeenCalledTimes(1);

		dialog.unregister(id);
		expect(sendModal).toHaveBeenCalledTimes(1);

		dialog.releaseModal(lightbox);
		expect(sendModal).toHaveBeenCalledTimes(2);
		expect(dialog.modalHolders).toEqual([]);
	});
});
