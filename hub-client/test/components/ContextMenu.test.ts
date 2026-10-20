// Packages
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

// Components
import ContextMenu from '@hub-client/components/elements/ContextMenu.vue';

// Stores
import { useContextMenuStore } from '@hub-client/stores/contextMenu.store';
import { useSettings } from '@hub-client/stores/settings';

enableAutoUnmount(afterEach);

describe('ContextMenu.vue', () => {
	const mountMenu = () => mount(ContextMenu, { global: { stubs: { teleport: true } } });
	const backdrop = (wrapper: ReturnType<typeof mountMenu>) => wrapper.find('.fixed.inset-0');

	beforeEach(() => {
		setActivePinia(createPinia());
	});

	test('reserves icon space when some items have an icon', async () => {
		const wrapper = mountMenu();
		useContextMenuStore().open([{ label: 'Newest first', icon: 'check' }, { label: 'Oldest first' }], 0, 0);
		await flushPromises();

		const items = wrapper.findAll('[role="menuitem"]');
		expect(items[1].find('span[aria-hidden="true"]').exists()).toBe(true);
	});

	test('reserves no icon space when no item has an icon', async () => {
		const wrapper = mountMenu();
		useContextMenuStore().open([{ label: 'One' }, { label: 'Two' }], 0, 0);
		await flushPromises();

		expect(wrapper.find('[role="menuitem"] span[aria-hidden="true"]').exists()).toBe(false);
	});

	test('a desktop menu leaves the page undimmed and closes on a click outside', async () => {
		useSettings().isMobileState = false;
		const wrapper = mountMenu();
		const store = useContextMenuStore();
		store.open([{ label: 'One' }], 0, 0);
		await flushPromises();

		expect(backdrop(wrapper).classes()).not.toContain('bg-scrim/50');
		await backdrop(wrapper).trigger('pointerdown');
		expect(store.isOpen).toBe(false);
	});

	test('the mobile drawer darkens the page behind it', async () => {
		useSettings().isMobileState = true;
		const wrapper = mountMenu();
		useContextMenuStore().open([{ label: 'One' }], 0, 0);
		await flushPromises();

		expect(backdrop(wrapper).classes()).toContain('bg-scrim/50');
	});
});
