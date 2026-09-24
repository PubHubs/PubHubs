// Packages
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import Button from '@hub-client/components/elements/Button.vue';

// Models
import { Hub } from '@global-client/models/Hubs';

// Pages
import HubsOverview from '@global-client/pages/HubsOverview.vue';

// Stores
import { useGlobal } from '@global-client/stores/global';
import { useHubs } from '@global-client/stores/hubs';

import { setUpi18n } from '@hub-client/i18n';

// The layout, grid and cards are not what these tests are about. The grid stub lists the hubs it is
// handed by name and keeps the `append` slot, which is where the page puts the 'add hub' card.
const stubs = {
	HubsPageLayout: { template: '<div><slot /></div>' },
	HubGrid: {
		props: ['hubs', 'loading', 'skeletonCount'],
		template: '<div><span v-for="hub in hubs" :key="hub.hubId" class="hub">{{ hub.hubName }}</span><slot name="append" /></div>',
	},
	AddHubBlock: { emits: ['discover'], template: '<button class="add-hub" @click="$emit(\'discover\')" />' },
};

describe('HubsOverview.vue', () => {
	let global: ReturnType<typeof useGlobal>;
	let i18n: ReturnType<typeof setUpi18n>;

	const mountOverview = async () => {
		const wrapper = mount(HubsOverview, { global: { plugins: [i18n], stubs } });
		await flushPromises();
		return wrapper;
	};

	const hubNames = (wrapper: Awaited<ReturnType<typeof mountOverview>>) => wrapper.findAll('.hub').map((hub) => hub.text());

	const tabButton = (wrapper: Awaited<ReturnType<typeof mountOverview>>, icon: 'push-pin' | 'compass') =>
		wrapper.findAllComponents(Button).find((button) => button.props('icon') === icon)!;

	const openDiscover = async (wrapper: Awaited<ReturnType<typeof mountOverview>>) => {
		await tabButton(wrapper, 'compass').trigger('click');
		await flushPromises();
	};

	const openPinned = async (wrapper: Awaited<ReturnType<typeof mountOverview>>) => {
		await tabButton(wrapper, 'push-pin').trigger('click');
		await flushPromises();
	};

	const retryButton = (wrapper: Awaited<ReturnType<typeof mountOverview>>) =>
		wrapper.findAllComponents(Button).find((button) => button.text() === i18n.global.t('common.retry'));

	const addHub = (hubId: string, hubName: string) => useHubs().addHub(new Hub(hubId, hubName, `http://${hubId}-client/`, `http://${hubId}/`));

	beforeEach(() => {
		setActivePinia(createPinia());
		i18n = setUpi18n();
		// FilterableList sizes its pages to its parent, which jsdom cannot measure.
		vi.stubGlobal(
			'ResizeObserver',
			class {
				observe() {}
				disconnect() {}
			},
		);

		global = useGlobal();
		global.pinnedHubs = [{ hubId: 'testhub0id', hubName: 'TestHub0' }];
		addHub('testhub0id', 'TestHub0');
		// Stands in for the discover load: the rest of the hubs only arrive once it runs.
		vi.spyOn(global, 'getAllHubs').mockImplementation(async () => {
			addHub('testhub1id', 'TestHub1');
			addHub('testhub2id', 'TestHub2');
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	test('the pinned tab shows only the pinned hubs', async () => {
		addHub('testhub1id', 'TestHub1');
		const wrapper = await mountOverview();

		expect(hubNames(wrapper)).toEqual(['TestHub0']);
	});

	test('the discover tab shows only the hubs that are not pinned', async () => {
		const wrapper = await mountOverview();
		await openDiscover(wrapper);

		expect(hubNames(wrapper)).toEqual(['TestHub1', 'TestHub2']);
	});

	test('every hub is fetched only once the discover tab opens', async () => {
		const wrapper = await mountOverview();
		expect(global.getAllHubs).not.toHaveBeenCalled();

		await openDiscover(wrapper);
		expect(global.getAllHubs).toHaveBeenCalledTimes(1);
	});

	test('switching tabs after a successful load does not fetch again', async () => {
		const wrapper = await mountOverview();
		await openDiscover(wrapper);
		await openPinned(wrapper);
		await openDiscover(wrapper);

		expect(global.getAllHubs).toHaveBeenCalledTimes(1);
	});

	test('a failed load says so instead of claiming every hub is pinned', async () => {
		vi.mocked(global.getAllHubs).mockRejectedValue(new Error('PHC is down'));
		const wrapper = await mountOverview();
		await openDiscover(wrapper);

		expect(wrapper.text()).toContain(i18n.global.t('home.load_hubs_failed'));
		expect(wrapper.text()).not.toContain(i18n.global.t('home.pinned_all_hubs'));
		expect(retryButton(wrapper)).toBeDefined();
	});

	test('retrying after a failed load shows the hubs', async () => {
		vi.mocked(global.getAllHubs).mockRejectedValueOnce(new Error('PHC is down'));
		const wrapper = await mountOverview();
		await openDiscover(wrapper);

		await retryButton(wrapper)!.trigger('click');
		await flushPromises();

		expect(hubNames(wrapper)).toEqual(['TestHub1', 'TestHub2']);
		expect(wrapper.text()).not.toContain(i18n.global.t('home.load_hubs_failed'));
	});

	test('reopening the discover tab after a failed load tries again', async () => {
		vi.mocked(global.getAllHubs).mockRejectedValueOnce(new Error('PHC is down'));
		const wrapper = await mountOverview();
		await openDiscover(wrapper);
		await openPinned(wrapper);
		await openDiscover(wrapper);

		expect(global.getAllHubs).toHaveBeenCalledTimes(2);
		expect(hubNames(wrapper)).toEqual(['TestHub1', 'TestHub2']);
	});

	test('the discover tab says every hub is pinned when there is nothing left to pin', async () => {
		vi.mocked(global.getAllHubs).mockResolvedValue();
		const wrapper = await mountOverview();
		await openDiscover(wrapper);

		expect(wrapper.text()).toContain(i18n.global.t('home.pinned_all_hubs'));
	});

	test('the discover tab says no hubs are available when nothing is pinned and nothing is left to pin', async () => {
		global.pinnedHubs = [];
		useHubs().hubs = {};
		vi.mocked(global.getAllHubs).mockResolvedValue();
		const wrapper = await mountOverview();
		await openDiscover(wrapper);

		expect(wrapper.text()).toContain(i18n.global.t('home.no_hubs_available'));
		expect(wrapper.text()).not.toContain(i18n.global.t('home.pinned_all_hubs'));
	});

	test('the add hub card is shown on the pinned tab only', async () => {
		global.pinnedHubs = [];
		const wrapper = await mountOverview();
		expect(wrapper.find('.add-hub').exists()).toBe(true);

		await openDiscover(wrapper);
		expect(wrapper.find('.add-hub').exists()).toBe(false);
	});

	test('the add hub card opens the discover tab', async () => {
		global.pinnedHubs = [];
		const wrapper = await mountOverview();
		await wrapper.find('.add-hub').trigger('click');
		await flushPromises();

		expect(global.getAllHubs).toHaveBeenCalledTimes(1);
		expect(hubNames(wrapper)).toEqual(['TestHub0', 'TestHub1', 'TestHub2']);
	});
});
