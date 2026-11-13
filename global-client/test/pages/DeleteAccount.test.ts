// Packages
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { markRaw } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';

// Logic
import { routes } from '@global-client/logic/core/routes';

// Pages
import DeleteAccount from '@global-client/pages/DeleteAccount.vue';

// Stores
import { useGlobal } from '@global-client/stores/global';
import { useMSS } from '@global-client/stores/mss';

import { DialogNo, DialogYes, useDialog } from '@hub-client/stores/dialog';

import { setUpi18n } from '@hub-client/i18n';

describe('DeleteAccount.vue', () => {
	let global: ReturnType<typeof useGlobal>;
	let mss: ReturnType<typeof useMSS>;
	let router: ReturnType<typeof createRouter>;

	const mountPage = async () => {
		const wrapper = mount(DeleteAccount, { global: { plugins: [router, setUpi18n()] } });
		await flushPromises();
		return wrapper;
	};

	beforeEach(async () => {
		setActivePinia(createPinia());
		router = createRouter({ history: createWebHistory(), routes });
		await router.replace('/delete-account');
		router.push = vi.fn(() => Promise.resolve());

		global = useGlobal();
		// As main.ts does: kept raw, so the store does not unwrap the router's refs.
		global.router = markRaw(router);
		global.loggedIn = true;

		mss = useMSS();
		vi.spyOn(mss, 'logout').mockImplementation(() => {});
		vi.spyOn(mss.phcServer, 'deleteAccountEP').mockResolvedValue('Deleted');
	});

	test('logged out, it explains and offers to log in, coming back here after', async () => {
		global.loggedIn = false;
		const wrapper = await mountPage();

		expect(wrapper.find('[data-testid="delete-account"]').exists()).toBe(false);
		await wrapper.find('[data-testid="login-to-delete-account"]').trigger('click');

		expect(router.push).toHaveBeenCalledWith({ name: 'login', query: { redirect: '/delete-account' } });
	});

	test('deletes the account once confirmed, and says so here', async () => {
		vi.spyOn(useDialog(), 'yesno').mockResolvedValue(DialogYes);
		const wrapper = await mountPage();

		await wrapper.find('[data-testid="delete-account"]').trigger('click');
		await flushPromises();

		expect(mss.phcServer.deleteAccountEP).toHaveBeenCalledOnce();
		// Logged out, but still here: this page needs no login, so logging out does not leave it.
		expect(global.loggedIn).toBe(false);
		expect(wrapper.find('[data-testid="account-deleted"]').exists()).toBe(true);
		expect(wrapper.find('[data-testid="login-to-delete-account"]').exists()).toBe(false);
	});

	test('does nothing without confirmation', async () => {
		vi.spyOn(useDialog(), 'yesno').mockResolvedValue(DialogNo);
		const wrapper = await mountPage();

		await wrapper.find('[data-testid="delete-account"]').trigger('click');
		await flushPromises();

		expect(mss.phcServer.deleteAccountEP).not.toHaveBeenCalled();
		expect(wrapper.find('[data-testid="account-deleted"]').exists()).toBe(false);
	});

	test('a failure is reported, and the button stays', async () => {
		vi.spyOn(useDialog(), 'yesno').mockResolvedValue(DialogYes);
		const showError = vi.spyOn(useDialog(), 'showError').mockResolvedValue(undefined);
		vi.mocked(mss.phcServer.deleteAccountEP).mockResolvedValue('Banned');
		const wrapper = await mountPage();

		await wrapper.find('[data-testid="delete-account"]').trigger('click');
		await flushPromises();

		expect(showError).toHaveBeenCalledOnce();
		expect(wrapper.find('[data-testid="account-deleted"]').exists()).toBe(false);
		expect(wrapper.find('[data-testid="delete-account"]').exists()).toBe(true);
	});

	describe('the back button', () => {
		/** What the router keeps in the history state about the page before this one. */
		const cameFrom = (back: string | null) => window.history.replaceState({ ...window.history.state, back }, '');

		const clickBack = async () => {
			const wrapper = await mountPage();
			await wrapper.find('[data-testid="delete-account-back"]').trigger('click');
		};

		beforeEach(() => {
			router.back = vi.fn();
		});

		test('goes back to where the user was in the app', async () => {
			cameFrom('/hub/TestHub0/someRoomId');

			await clickBack();

			expect(router.back).toHaveBeenCalledOnce();
			expect(router.push).not.toHaveBeenCalled();
		});

		test('goes to the hubs overview when this is where the user came in', async () => {
			cameFrom(null);

			await clickBack();

			expect(router.back).not.toHaveBeenCalled();
			expect(router.push).toHaveBeenCalledWith({ name: 'hubs-overview' });
		});

		test('does not go back into logging in', async () => {
			cameFrom('/login?redirect=/delete-account');

			await clickBack();

			expect(router.back).not.toHaveBeenCalled();
			expect(router.push).toHaveBeenCalledWith({ name: 'hubs-overview' });
		});
	});
});
