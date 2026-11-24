// Packages
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createI18n } from 'vue-i18n';

// Components
import FilterableList from '@hub-client/components/ui/FilterableList.vue';

// Locales
import { en } from '@hub-client/locales/en';

// Without a measurable parent (jsdom has no layout) the list falls back to pages of 10.
const pageSize = 10;

const items = Array.from({ length: pageSize + 2 }, (_, i) => ({ name: `Item ${i}` }));

const stubs = {
	// A plain input standing in for the search field, so a test can type into it.
	TextField: {
		props: ['modelValue'],
		emits: ['update:modelValue'],
		template: '<input class="search" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
	},
};

describe('FilterableList.vue', () => {
	const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } });

	const mountList = async (props: Record<string, unknown>, slots: Record<string, string> = {}) => {
		const wrapper = mount(FilterableList, {
			props: { filterKeys: ['name'], ...props },
			slots: {
				filtered: `<template #filtered="{ items }"><span v-for="item in items" :key="item.name" class="item">{{ item.name }}</span></template>`,
				...slots,
			},
			global: { plugins: [i18n], stubs },
		});
		await flushPromises();
		return wrapper;
	};

	const shownItems = (wrapper: Awaited<ReturnType<typeof mountList>>) => wrapper.findAll('.item').map((item) => item.text());

	const pageIndicator = (wrapper: Awaited<ReturnType<typeof mountList>>) => wrapper.text().includes(i18n.global.t('others.page_x_of_y', [1, 2]));

	beforeEach(() => {
		setActivePinia(createPinia());
		vi.stubGlobal(
			'ResizeObserver',
			class {
				observe() {}
				disconnect() {}
			},
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe('pagination', () => {
		test('splits the items over pages by default', async () => {
			const wrapper = await mountList({ items });

			expect(shownItems(wrapper)).toHaveLength(pageSize);
			expect(pageIndicator(wrapper)).toBe(true);
		});

		test('shows every item without page controls when turned off', async () => {
			const wrapper = await mountList({ items, paginate: false });

			expect(shownItems(wrapper)).toHaveLength(items.length);
			expect(pageIndicator(wrapper)).toBe(false);
		});
	});

	describe('empty list', () => {
		test('shows the empty text when there are no items', async () => {
			const wrapper = await mountList({ items: [], emptyText: 'Nothing here' });

			expect(wrapper.text()).toContain('Nothing here');
		});

		test('the empty slot takes the place of the empty text', async () => {
			const wrapper = await mountList({ items: [], emptyText: 'Nothing here' }, { empty: '<div class="custom-empty">Add one</div>' });

			expect(wrapper.find('.custom-empty').exists()).toBe(true);
			expect(wrapper.text()).not.toContain('Nothing here');
		});

		test('a search without results says so rather than showing the empty slot', async () => {
			const wrapper = await mountList({ items }, { empty: '<div class="custom-empty">Add one</div>' });
			await wrapper.find('.search').setValue('no such item');

			expect(wrapper.text()).toContain(i18n.global.t('others.search_nothing_found'));
			expect(wrapper.find('.custom-empty').exists()).toBe(false);
		});
	});
});
