// Packages
import { flushPromises, shallowMount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createRouter, createWebHistory } from 'vue-router';

import Button from '@hub-client/components/elements/Button.vue';

// Logic
import { routes } from '@global-client/logic/core/routes';

// Pages
import Login from '@global-client/pages/Login.vue';

// Stores
import { useMSS } from '@global-client/stores/mss';

import { setUpi18n } from '@hub-client/i18n';

const pageShow = (persisted: boolean) => {
	const event = new Event('pageshow');
	Object.defineProperty(event, 'persisted', { value: persisted });
	window.dispatchEvent(event);
};

describe('Login.vue', () => {
	let mss: ReturnType<typeof useMSS>;

	const mountLogin = async () => {
		const router = createRouter({ history: createWebHistory(), routes });
		router.push = vi.fn(() => Promise.resolve());
		router.replace = vi.fn(() => Promise.resolve());

		const wrapper = shallowMount(Login, { global: { plugins: [router, setUpi18n()] } });
		await flushPromises();
		return wrapper;
	};

	// The login button is the first one; the second sits inside the register link.
	const loginButton = (wrapper: Awaited<ReturnType<typeof mountLogin>>) => wrapper.findAllComponents(Button)[0];

	// The message shown in place of a login, below the button rather than inside the popup.
	const errorBanner = (wrapper: Awaited<ReturnType<typeof mountLogin>>) => wrapper.find('.text-accent-error');

	beforeEach(() => {
		setActivePinia(createPinia());
		mss = useMSS();

		vi.spyOn(mss, 'initializeServers').mockResolvedValue(undefined);
		// A login that stays on the QR code, unless a test says otherwise.
		vi.spyOn(mss, 'enterPubHubs').mockReturnValue(new Promise(() => {}));
		vi.spyOn(mss, 'cancelEnter').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	test('The button opens the popup and starts a session', async () => {
		const wrapper = await mountLogin();

		loginButton(wrapper).vm.$emit('click');
		await flushPromises();

		expect(mss.enterPubHubs).toHaveBeenCalledTimes(1);
		wrapper.unmount();
	});

	test('Closing the popup ends the session instead of starting a second one', async () => {
		const wrapper = await mountLogin();

		loginButton(wrapper).vm.$emit('click');
		await flushPromises();
		loginButton(wrapper).vm.$emit('click');
		await flushPromises();

		expect(mss.cancelEnter).toHaveBeenCalled();
		expect(mss.enterPubHubs).toHaveBeenCalledTimes(1);
		wrapper.unmount();
	});

	test('Leaving the page ends the session behind the popup', async () => {
		const wrapper = await mountLogin();

		loginButton(wrapper).vm.$emit('click');
		await flushPromises();
		wrapper.unmount();

		expect(mss.cancelEnter).toHaveBeenCalled();
	});

	test('A new attempt takes away the message the previous one left', async () => {
		// The banner sits outside the popup, so closing the popup does not take it with it: the QR code
		// of the new attempt would otherwise appear underneath the reason the previous one failed.
		vi.mocked(mss.enterPubHubs).mockResolvedValue({ key: 'errors.yivi_session_failed' });
		const wrapper = await mountLogin();

		loginButton(wrapper).vm.$emit('click');
		await flushPromises();
		expect(errorBanner(wrapper).exists()).toBe(true);

		vi.mocked(mss.enterPubHubs).mockReturnValue(new Promise(() => {}));
		loginButton(wrapper).vm.$emit('click');
		await flushPromises();

		expect(errorBanner(wrapper).exists()).toBe(false);
		wrapper.unmount();
	});

	test('An attempt that was superseded neither reports nor navigates', async () => {
		// `enterPubHubs` only reports a cancellation as `EnterCancelled` up to the disclosure; an attempt
		// that gets past it and is then replaced runs to completion and resolves normally. Its result
		// belongs to a popup that is no longer on screen, so acting on it would close the session the
		// user is scanning right now, or navigate away from underneath it.
		let finishFirst!: (result: { key: string } | undefined) => void;
		vi.mocked(mss.enterPubHubs).mockReturnValueOnce(new Promise((resolve) => (finishFirst = resolve)));
		const wrapper = await mountLogin();

		loginButton(wrapper).vm.$emit('click');
		await flushPromises();

		// Close, then start a second attempt - the first one is still in flight behind it.
		loginButton(wrapper).vm.$emit('click');
		await flushPromises();
		loginButton(wrapper).vm.$emit('click');
		await flushPromises();
		expect(mss.enterPubHubs).toHaveBeenCalledTimes(2);

		vi.mocked(mss.cancelEnter).mockClear();
		finishFirst({ key: 'errors.yivi_session_failed' });
		await flushPromises();

		// The second attempt keeps its popup and its live session; nothing of the first reaches the page.
		expect(errorBanner(wrapper).exists()).toBe(false);
		expect(mss.cancelEnter).not.toHaveBeenCalled();
		wrapper.unmount();
	});

	test('A superseded attempt that succeeded does not navigate either', async () => {
		const router = createRouter({ history: createWebHistory(), routes });
		router.push = vi.fn(() => Promise.resolve());
		router.replace = vi.fn(() => Promise.resolve());

		let finishFirst!: (result: undefined) => void;
		vi.mocked(mss.enterPubHubs).mockReturnValueOnce(new Promise((resolve) => (finishFirst = resolve)));
		const wrapper = shallowMount(Login, { global: { plugins: [router, setUpi18n()] } });
		await flushPromises();

		loginButton(wrapper).vm.$emit('click');
		await flushPromises();
		loginButton(wrapper).vm.$emit('click');
		await flushPromises();
		loginButton(wrapper).vm.$emit('click');
		await flushPromises();

		finishFirst(undefined);
		await flushPromises();

		expect(router.replace).not.toHaveBeenCalled();
		wrapper.unmount();
	});

	test('The page listener is taken off when the page is left', async () => {
		const wrapper = await mountLogin();
		wrapper.unmount();
		vi.mocked(mss.cancelEnter).mockClear();

		pageShow(true);
		await flushPromises();

		expect(mss.cancelEnter).not.toHaveBeenCalled();
	});
});
