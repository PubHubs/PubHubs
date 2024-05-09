import { describe, expect, test, beforeEach, afterEach, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { useSettings } from '@/store/store';
import Logo from '@/components/ui/Logo.vue';

describe('Logo.vue Test', () => {
	let wrapper;
	let settings;

	beforeEach(() => {
		//Mock window.matchMedia and say we don't prefer dark
		vi.stubGlobal('matchMedia', (_) => false);

		wrapper = mount(Logo, {
			// props: {theme: 'light'}, don't set property since else we don't trigger the call to settings.theme, and we don't get reactivity.
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
		expect(wrapper.find('img').attributes().src).toBe('/img/logo.svg');

		settings.$patch({
			theme: 'dark',
		});

		await flushPromises();

		expect(wrapper.find('img').attributes().src).toBe('/img/logo-dark.svg');
	});
});
