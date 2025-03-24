import Logo from '@/components/ui/Logo.vue';
import { useSettings } from '@/logic/store/settings';
import { createTestingPinia } from '@pinia/testing';
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

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
		expect(wrapper.find('img').attributes().src).toMatch(/\/(client\/)?img\/pubhubs-logo\.svg/);

		settings.$patch({
			theme: 'dark',
		});

		await flushPromises();

		expect(wrapper.find('img').attributes().src).toMatch(/\/(client\/)?img\/pubhubs-logo\.svg/);
	});
});
