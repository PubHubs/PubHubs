// Packages
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createRouter, createWebHistory } from 'vue-router';

// Logic
import { routes } from '@hub-client/logic/core/router';

// Pages
import DeleteHubAccount from '@hub-client/pages/DeleteHubAccount.vue';

// Stores
import { DialogNo, DialogYes, useDialog } from '@hub-client/stores/dialog';
import { Message, MessageType, useMessageBox } from '@hub-client/stores/messagebox';
import { usePubhubsStore } from '@hub-client/stores/pubhubs';

import { setUpi18n } from '@hub-client/i18n';

describe('DeleteHubAccount.vue', () => {
	let messagebox: ReturnType<typeof useMessageBox>;
	let pubhubs: ReturnType<typeof usePubhubsStore>;
	let router: ReturnType<typeof createRouter>;

	const mountPage = async () => {
		const wrapper = mount(DeleteHubAccount, { global: { plugins: [router, setUpi18n()] } });
		await flushPromises();
		return wrapper;
	};

	const clickDeactivate = async (wrapper: Awaited<ReturnType<typeof mountPage>>) => {
		await wrapper.find('[data-testid="deactivate-account"]').trigger('click');
		await flushPromises();
	};

	/** The global client answering the request to deactivate. */
	const answer = async (content: { success: boolean; error?: string }) => {
		messagebox.callbacks.get('parentFrame')![MessageType.DeactivationResult](new Message(MessageType.DeactivationResult, content));
		await flushPromises();
	};

	beforeEach(async () => {
		setActivePinia(createPinia());
		router = createRouter({ history: createWebHistory(), routes });
		await router.replace('/delete-hub-account');
		router.push = vi.fn(() => Promise.resolve());

		messagebox = useMessageBox();
		messagebox.inIframe = true;
		vi.spyOn(messagebox, 'sendMessage').mockImplementation(() => {});

		pubhubs = usePubhubsStore();
		vi.spyOn(pubhubs.Auth, 'getAccessToken').mockReturnValue('token');
		vi.spyOn(pubhubs, 'logout').mockImplementation(() => {});
	});

	test('asks the global client to deactivate once confirmed, and says so when it did', async () => {
		vi.spyOn(useDialog(), 'yesno').mockResolvedValue(DialogYes);
		const wrapper = await mountPage();

		await clickDeactivate(wrapper);

		expect(messagebox.sendMessage).toHaveBeenCalledWith(new Message(MessageType.RequestDeactivation, { accessToken: 'token' }));
		expect(wrapper.find('[data-testid="deactivate-account"]').attributes('disabled')).toBeDefined();

		await answer({ success: true });

		expect(pubhubs.logout).toHaveBeenCalledOnce();
		expect(wrapper.find('[data-testid="hub-account-deactivated"]').exists()).toBe(true);
		expect(wrapper.find('[data-testid="deactivate-account"]').exists()).toBe(false);
	});

	test('does nothing without confirmation', async () => {
		vi.spyOn(useDialog(), 'yesno').mockResolvedValue(DialogNo);
		const wrapper = await mountPage();

		await clickDeactivate(wrapper);

		expect(messagebox.sendMessage).not.toHaveBeenCalled();
		expect(wrapper.find('[data-testid="hub-account-deactivated"]').exists()).toBe(false);
	});

	test('a failure is reported, and the button can be used again', async () => {
		vi.spyOn(useDialog(), 'yesno').mockResolvedValue(DialogYes);
		const showError = vi.spyOn(useDialog(), 'showError').mockResolvedValue(undefined);
		const wrapper = await mountPage();

		await clickDeactivate(wrapper);
		await answer({ success: false, error: 'Max attempts for RetryFromStart were passed' });

		expect(showError).toHaveBeenCalledOnce();
		expect(pubhubs.logout).not.toHaveBeenCalled();
		expect(wrapper.find('[data-testid="hub-account-deactivated"]').exists()).toBe(false);
		expect(wrapper.find('[data-testid="deactivate-account"]').attributes('disabled')).toBeUndefined();
	});

	test('standalone, it refuses: only the global client can prove the pseudonym', async () => {
		messagebox.inIframe = false;
		vi.spyOn(useDialog(), 'yesno').mockResolvedValue(DialogYes);
		const showError = vi.spyOn(useDialog(), 'showError').mockResolvedValue(undefined);
		const wrapper = await mountPage();

		await clickDeactivate(wrapper);

		expect(messagebox.sendMessage).not.toHaveBeenCalled();
		expect(showError).toHaveBeenCalledOnce();
		expect(pubhubs.logout).not.toHaveBeenCalled();
		expect(wrapper.find('[data-testid="hub-account-deactivated"]').exists()).toBe(false);
	});

	test('stops listening for the answer when left', async () => {
		const wrapper = await mountPage();
		expect(messagebox.callbacks.get('parentFrame')?.[MessageType.DeactivationResult]).toBeDefined();

		wrapper.unmount();

		expect(messagebox.callbacks.get('parentFrame')?.[MessageType.DeactivationResult]).toBeUndefined();
	});

	describe('the back button', () => {
		/** What the router keeps in the history state about the page before this one. */
		const cameFrom = (back: string | null) => window.history.replaceState({ ...window.history.state, back }, '');

		const clickBack = async () => {
			const wrapper = await mountPage();
			await wrapper.find('[data-testid="deactivate-account-back"]').trigger('click');
		};

		beforeEach(() => {
			router.back = vi.fn();
		});

		test('goes back to where the user was in the hub', async () => {
			cameFrom('/discover-rooms');

			await clickBack();

			expect(router.back).toHaveBeenCalledOnce();
			expect(router.push).not.toHaveBeenCalled();
		});

		test("goes to the hub's home page when this is where the user came in", async () => {
			cameFrom(null);

			await clickBack();

			expect(router.back).not.toHaveBeenCalled();
			expect(router.push).toHaveBeenCalledWith({ name: 'home' });
		});
	});
});
