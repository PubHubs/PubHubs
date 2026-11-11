// Packages
import { flushPromises, shallowMount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';

// Logic
import { routes } from '@global-client/logic/core/routes';

// Models
import { Hub as HubModel } from '@global-client/models/Hubs';

// Pages
import Hub from '@global-client/pages/Hub.vue';

// Stores
import { useGlobal } from '@global-client/stores/global';
import { useHubs } from '@global-client/stores/hubs';

import { useSettings } from '@hub-client/stores/settings';

// The page backs off between lookups of a hub it cannot find yet; waiting that out would only slow
// the tests down.
vi.mock('@hub-client/logic/utils/common', () => ({ delay: vi.fn(() => Promise.resolve()) }));

describe('Hub.vue', () => {
	let global: ReturnType<typeof useGlobal>;
	let hubs: ReturnType<typeof useHubs>;

	const addHub = (hubId: string, hubName: string) => hubs.addHub(new HubModel(hubId, hubName, `http://${hubId}-client/`, `http://${hubId}/`));

	const mountHub = async (path: string) => {
		const router = createRouter({ history: createMemoryHistory(), routes });
		await router.push(path);
		await router.isReady();

		const wrapper = shallowMount(Hub, { global: { plugins: [router] } });
		await flushPromises();
		return { router, wrapper };
	};

	beforeEach(() => {
		setActivePinia(createPinia());
		global = useGlobal();
		hubs = useHubs();

		// Logged out, so entering a hub only builds the iframe url and needs no hub login.
		global.loggedIn = false;
		addHub('testhub0id', 'TestHub0');

		// Stands in for fetching a hub from PHC: only TestHub1 exists besides the one loaded above.
		vi.spyOn(global, 'getHubData').mockImplementation(async (hubName: string) => {
			if (hubName === 'TestHub1') addHub('testhub1id', 'TestHub1');
		});
		vi.spyOn(hubs, 'changeHub').mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	test('a hub that is already loaded is entered without fetching it', async () => {
		await mountHub('/hub/TestHub0');

		expect(global.getHubData).not.toHaveBeenCalled();
		expect(hubs.changeHub).toHaveBeenCalledWith(expect.objectContaining({ name: 'TestHub0' }));
	});

	test('a hub that is not loaded yet is fetched and then entered', async () => {
		await mountHub('/hub/TestHub1');

		expect(global.getHubData).toHaveBeenCalledTimes(1);
		expect(global.getHubData).toHaveBeenCalledWith('TestHub1');
		expect(hubs.changeHub).toHaveBeenCalledWith(expect.objectContaining({ name: 'TestHub1' }));
	});

	test('moving to another room of the same hub does not fetch the hub again', async () => {
		const { router } = await mountHub('/hub/TestHub1');
		await router.push('/hub/TestHub1/someRoomId');
		await flushPromises();

		expect(global.getHubData).toHaveBeenCalledTimes(1);
		expect(hubs.changeHub).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'TestHub1', roomId: 'someRoomId' }));
	});

	test('a hub that does not exist sends the user to the hubs overview', async () => {
		const router = createRouter({ history: createMemoryHistory(), routes });
		await router.push('/hub/NoSuchHub');
		await router.isReady();
		const push = vi.spyOn(router, 'push').mockResolvedValue(undefined);

		shallowMount(Hub, { global: { plugins: [router] } });
		await flushPromises();

		expect(push).toHaveBeenCalledWith({ name: 'hubs-overview' });
		expect(hubs.changeHub).not.toHaveBeenCalled();
	});

	test('a failed fetch sends the user to the hubs overview rather than throwing', async () => {
		vi.mocked(global.getHubData).mockRejectedValue(new Error('PHC is down'));
		const router = createRouter({ history: createMemoryHistory(), routes });
		await router.push('/hub/TestHub1');
		await router.isReady();
		const push = vi.spyOn(router, 'push').mockResolvedValue(undefined);

		shallowMount(Hub, { global: { plugins: [router] } });
		await flushPromises();

		expect(push).toHaveBeenCalledWith({ name: 'hubs-overview' });
	});

	test('entering a hub remembers it as the last visited hub', async () => {
		await mountHub('/hub/TestHub0');

		expect(useSettings().getLastVisitedHub).toEqual('testhub0id');
	});

	describe('when entering the hub fails', () => {
		const mountHubWithPushSpy = async (path: string) => {
			const router = createRouter({ history: createMemoryHistory(), routes });
			await router.push(path);
			await router.isReady();
			const push = vi.spyOn(router, 'push').mockResolvedValue(undefined);

			shallowMount(Hub, { global: { plugins: [router] } });
			await flushPromises();
			return { push };
		};

		test('a failed hub login does not enter the hub', async () => {
			// Logged in, but without a token for this hub, so the hub login has to run.
			global.loggedIn = true;
			vi.spyOn(HubModel.prototype, 'enterStartEP').mockRejectedValue(new Error('enter failed'));

			const { push } = await mountHubWithPushSpy('/hub/TestHub0');

			expect(push).toHaveBeenCalledWith({ name: 'error' });
			expect(hubs.changeHub).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'TestHub0' }));
			expect(useSettings().getLastVisitedHub).not.toEqual('testhub0id');
		});

		test('a hub that cannot be found anymore sends the user to the hubs overview', async () => {
			// The hub is known by name, but is gone by the time it is entered.
			vi.spyOn(hubs, 'hub', 'get').mockReturnValue(() => undefined);

			const { push } = await mountHubWithPushSpy('/hub/TestHub0');

			expect(push).toHaveBeenCalledWith({ name: 'hubs-overview' });
			expect(hubs.changeHub).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'TestHub0' }));
			expect(useSettings().getLastVisitedHub).not.toEqual('testhub0id');
		});
	});

	describe('a run that is still loading when it is left', () => {
		// Holds the fetch of TestHub1 until the test lets it finish, as right after login when the hubs
		// are still loading.
		let finishFetch: () => void;

		beforeEach(() => {
			vi.mocked(global.getHubData).mockImplementationOnce(
				(hubName: string) =>
					new Promise<void>((resolve) => {
						finishFetch = () => {
							if (hubName === 'TestHub1') addHub('testhub1id', 'TestHub1');
							resolve();
						};
					}),
			);
		});

		test('does not enter the hub once the page is gone, even when the user came back to it', async () => {
			const router = createRouter({ history: createMemoryHistory(), routes });
			await router.push('/hub/TestHub1');
			await router.isReady();
			const left = shallowMount(Hub, { global: { plugins: [router] } });
			await flushPromises();

			// Leave for the hubs overview, then come back to the same hub.
			await router.push('/hubs-overview');
			left.unmount();
			await router.push('/hub/TestHub1');
			const push = vi.spyOn(router, 'push');
			const changeHub = vi.mocked(hubs.changeHub);
			changeHub.mockClear();
			shallowMount(Hub, { global: { plugins: [router] } });
			await flushPromises();

			finishFetch();
			await flushPromises();

			// Only the page the user came back to enters the hub; the left one must not.
			expect(changeHub.mock.calls.filter(([params]) => params.name === 'TestHub1')).toHaveLength(1);
			expect(push).not.toHaveBeenCalled();
		});

		test('does nothing once the page is unmounted', async () => {
			const { router, wrapper } = await mountHub('/hub/TestHub1');
			const push = vi.spyOn(router, 'push');
			wrapper.unmount();
			vi.mocked(hubs.changeHub).mockClear();

			finishFetch();
			await flushPromises();

			expect(hubs.changeHub).not.toHaveBeenCalled();
			expect(push).not.toHaveBeenCalled();
			expect(useSettings().getLastVisitedHub).not.toEqual('testhub1id');
		});

		test('gives way to a newer route change on the same page', async () => {
			const { router } = await mountHub('/hub/TestHub1');
			await router.push('/hub/TestHub0');
			await flushPromises();

			finishFetch();
			await flushPromises();

			expect(hubs.changeHub).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'TestHub1' }));
			expect(hubs.changeHub).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'TestHub0' }));
		});
	});
});
