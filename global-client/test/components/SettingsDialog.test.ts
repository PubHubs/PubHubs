// Packages
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createRouter, createWebHistory } from 'vue-router';

// Components
import SettingsDialog from '@global-client/components/forms/SettingsDialog.vue';

// Logic
import { routes } from '@global-client/logic/core/routes';

import { setUpi18n } from '@hub-client/i18n';

describe('SettingsDialog.vue', () => {
	let router: ReturnType<typeof createRouter>;

	const mountDialog = async () => {
		const wrapper = mount(SettingsDialog, {
			global: { plugins: [router, setUpi18n()], stubs: { Dialog: { template: '<div><slot /></div>' } } },
		});
		await flushPromises();
		return wrapper;
	};

	beforeEach(() => {
		setActivePinia(createPinia());
		router = createRouter({ history: createWebHistory(), routes });
		router.push = vi.fn(() => Promise.resolve());
	});

	test('the delete button goes to the page for it', async () => {
		const wrapper = await mountDialog();

		await wrapper.find('[data-testid="delete-account"]').trigger('click');

		expect(router.push).toHaveBeenCalledWith({ name: 'delete-account' });
	});
});
