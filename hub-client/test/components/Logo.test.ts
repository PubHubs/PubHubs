// Packages
import { createTestingPinia } from '@pinia/testing';
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Components
import Logo from '@hub-client/components/ui/Logo.vue';

// Stores
import { useSettings } from '@hub-client/stores/settings';

describe('Logo.vue Test', () => {
	let wrapper;
	let settings;

	beforeEach(() => {
		// Mock window.matchMedia and say we don't prefer dark
		vi.stubGlobal('matchMedia', (_) => false);

		wrapper = mount(Logo, {
			// Props: {theme: 'light'}, don't set property since else we don't trigger the call to settings.theme, and we don't get reactivity.
			global: {
				plugins: [createTestingPinia()],
			},
		});

		settings = useSettings();
	});

	afterEach(() => {
		wrapper.unmount();
	});

	test('theme update of logo handled', async () => {
		expect(wrapper.find('img').attributes().src).toMatch(/\/(client\/)?img\/pubhubs-logo\.svg/);

		settings.$patch({
			theme: 'dark',
		});

		await flushPromises();

		expect(wrapper.find('img').attributes().src).toMatch(/\/(client\/)?img\/pubhubs-logo\.svg/);
	});
});
