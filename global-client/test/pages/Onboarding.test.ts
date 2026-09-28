// Packages
import { type VueWrapper, flushPromises, shallowMount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createRouter, createWebHistory } from 'vue-router';

import Button from '@hub-client/components/elements/Button.vue';
import InlineSpinner from '@hub-client/components/ui/InlineSpinner.vue';

// Logic
import { routes } from '@global-client/logic/core/routes';

// Models
import { PHCEnterMode } from '@global-client/models/MSS/TPHC';

// Pages
import Onboarding from '@global-client/pages/Onboarding.vue';

// Stores
import { useMSS } from '@global-client/stores/mss';

import { DialogOk, useDialog } from '@hub-client/stores/dialog';
import { useSettings } from '@hub-client/stores/settings';

import { setUpi18n } from '@hub-client/i18n';

// The carousel cards put the Yivi widget and the retry button in slots, which a default stub would
// leave unrendered.
const carouselCardStub = {
	template: '<div><slot name="title" /><slot /><slot name="image" /><slot name="extra" /><slot name="right" /></div>',
};

// What the Yivi widget does to its mount point once it is built: it renders its own form there,
// which is what the loading state is waiting for.
const renderYiviWidget = (wrapper: VueWrapper) => {
	const form = document.createElement('div');
	form.className = 'yivi-web-content';
	wrapper.find('.yivi-mount').element.replaceChildren(form);
};

// `pageshow` carries `persisted` only when the page comes back from the back/forward cache, and
// jsdom has no PageTransitionEvent to build that with.
const pageShow = (persisted: boolean) => {
	const event = new Event('pageshow');
	Object.defineProperty(event, 'persisted', { value: persisted });
	window.dispatchEvent(event);
};

describe('Onboarding.vue', () => {
	let mss: ReturnType<typeof useMSS>;
	let settings: ReturnType<typeof useSettings>;
	let dialog: ReturnType<typeof useDialog>;
	let push: ReturnType<typeof vi.fn>;

	// Which language the page starts in is derived from `navigator.language`, so a test that wants a
	// change has to flip to whichever of the two is not the current one.
	const switchLanguage = () => {
		settings.language = settings.getActiveLanguage === 'nl' ? 'en' : 'nl';
	};

	const mountOnboarding = async () => {
		const router = createRouter({ history: createWebHistory(), routes });
		push = vi.fn(() => Promise.resolve());
		router.push = push;

		const wrapper = shallowMount(Onboarding, {
			global: {
				plugins: [router, setUpi18n()],
				stubs: { CarouselCard: carouselCardStub, CarouselCardMobile: carouselCardStub },
			},
		});
		await flushPromises();
		return wrapper;
	};

	beforeEach(() => {
		setActivePinia(createPinia());
		mss = useMSS();
		settings = useSettings();
		dialog = useDialog();
		settings.isMobileState = true;

		// A registration that stays on the QR code, unless a test says otherwise.
		vi.spyOn(mss, 'enterPubHubs').mockReturnValue(new Promise(() => {}));
		vi.spyOn(mss, 'cancelEnter').mockImplementation(() => {});
		vi.spyOn(mss, 'issueCardAfterEntry').mockResolvedValue({ cardAttr: null, errorMessage: null });
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	test('A Yivi session is started when the page opens', async () => {
		await mountOnboarding();

		expect(mss.enterPubHubs).toHaveBeenCalledTimes(1);
	});

	test('A page restored from the back/forward cache starts a new session', async () => {
		// The listener has to be registered before the registration is awaited: that await only settles
		// once the whole flow is done, by which time the page is on its way out.
		const wrapper = await mountOnboarding();
		mss.awaitingDisclosure = true;

		pageShow(true);
		await flushPromises();

		expect(mss.enterPubHubs).toHaveBeenCalledTimes(2);
		wrapper.unmount();
	});

	test('An ordinary page load does not start a second session', async () => {
		const wrapper = await mountOnboarding();
		mss.awaitingDisclosure = true;

		pageShow(false);
		await flushPromises();

		expect(mss.enterPubHubs).toHaveBeenCalledTimes(1);
		wrapper.unmount();
	});

	test('A restart is left alone once the disclosure is in', async () => {
		const wrapper = await mountOnboarding();
		mss.awaitingDisclosure = false;

		pageShow(true);
		await flushPromises();

		expect(mss.enterPubHubs).toHaveBeenCalledTimes(1);
		wrapper.unmount();
	});

	test('Crossing the breakpoint re-renders the widget that was on screen', async () => {
		const wrapper = await mountOnboarding();
		mss.awaitingDisclosure = true;

		settings.isMobileState = false;
		await flushPromises();

		expect(mss.enterPubHubs).toHaveBeenCalledTimes(2);
		wrapper.unmount();
	});

	test('A restart keeps the terms the registration was started on', async () => {
		// The user answered the duplicate attribute dialog, which restarts the registration with
		// `registerOnlyWithUniqueAttrs` false. A widget that has to be re-rendered after that must not
		// fall back to the default, or the dialog comes straight back.
		vi.mocked(mss.enterPubHubs).mockResolvedValueOnce({ key: 'errors.notid_attribute_already_taken' });
		const wrapper = await mountOnboarding();

		dialog.close(DialogOk);
		await flushPromises();
		expect(mss.enterPubHubs).toHaveBeenLastCalledWith(expect.anything(), PHCEnterMode.LoginOrRegister, expect.anything(), false);

		mss.awaitingDisclosure = true;
		settings.isMobileState = false;
		await flushPromises();

		expect(mss.enterPubHubs).toHaveBeenLastCalledWith(expect.anything(), PHCEnterMode.LoginOrRegister, expect.anything(), false);
		wrapper.unmount();
	});

	test('A restart during the card issuance re-renders that widget, not the disclosure', async () => {
		// Chained sessions are off, so the card is issued in a second Yivi session shown in the same
		// mount point. Crossing the breakpoint there destroys the element it rendered into, and the
		// user is left with a QR code nobody can scan.
		vi.mocked(mss.enterPubHubs).mockResolvedValue({ key: 'errors.card_not_added', values: ['via email'] });
		vi.mocked(mss.issueCardAfterEntry).mockImplementation(() => {
			// The action raises this for as long as its Yivi session is up, which is what tells the page
			// there is a widget on screen to re-render.
			mss.issuingCard = true;
			return new Promise(() => {});
		});

		const wrapper = await mountOnboarding();
		expect(mss.issueCardAfterEntry).toHaveBeenCalledTimes(1);

		settings.isMobileState = false;
		await flushPromises();

		expect(mss.issueCardAfterEntry).toHaveBeenCalledTimes(2);
		expect(mss.enterPubHubs).toHaveBeenCalledTimes(1);
		wrapper.unmount();
	});

	test('A restart once the card issuance stopped rendering does not issue a second card', async () => {
		// The Yivi session is over and the issuance is writing the card to the user secret, which shows
		// nothing. Starting over there issues a second card and races a second write for the same user
		// secret against the one still in flight, which fails that write and reports a card that is
		// actually fine as `card_not_linked`.
		vi.mocked(mss.enterPubHubs).mockResolvedValue({ key: 'errors.card_not_added', values: ['via email'] });
		vi.mocked(mss.issueCardAfterEntry).mockImplementation(() => {
			mss.issuingCard = false;
			return new Promise(() => {});
		});

		const wrapper = await mountOnboarding();
		expect(mss.issueCardAfterEntry).toHaveBeenCalledTimes(1);

		settings.isMobileState = false;
		await flushPromises();

		expect(mss.issueCardAfterEntry).toHaveBeenCalledTimes(1);
		wrapper.unmount();
	});

	test('A restart while the enter run is issuing the card stops it so it can be retried', async () => {
		// Only that run knows what the card is being issued for, so the restart cancels it and lets it
		// report `card_not_added`, which the page then retries with the comment it carries.
		let reportCardNotAdded!: (result: { key: string; values: string[] }) => void;
		vi.mocked(mss.enterPubHubs).mockReturnValue(new Promise((resolve) => (reportCardNotAdded = resolve)));
		vi.mocked(mss.cancelEnter).mockImplementation(() => {
			mss.issuingCard = false;
			reportCardNotAdded({ key: 'errors.card_not_added', values: ['via email'] });
		});

		const wrapper = await mountOnboarding();
		mss.issuingCard = true;

		settings.isMobileState = false;
		await flushPromises();

		expect(mss.cancelEnter).toHaveBeenCalled();
		expect(mss.issueCardAfterEntry).toHaveBeenCalledWith('via email', expect.anything());
		wrapper.unmount();
	});

	test('Switching language re-renders the disclosure widget in the new language', async () => {
		// The widget takes its texts when it is constructed, so the one on screen keeps the language the
		// page has just left.
		const wrapper = await mountOnboarding();
		mss.awaitingDisclosure = true;

		switchLanguage();
		await flushPromises();

		expect(mss.enterPubHubs).toHaveBeenCalledTimes(2);
		wrapper.unmount();
	});

	test('Switching language leaves a card issuance that is already up alone', async () => {
		// The language toggle sits on this very page. Unlike a breakpoint swap it does not destroy the
		// element the widget rendered into, so there is nothing to re-render for - and restarting would
		// race the user approving the card in their Yivi app: lose that race and the card is issued
		// twice, behind an error saying it was never added at all.
		vi.mocked(mss.enterPubHubs).mockReturnValue(new Promise(() => {}));
		const wrapper = await mountOnboarding();
		mss.issuingCard = true;

		switchLanguage();
		await flushPromises();

		expect(mss.cancelEnter).not.toHaveBeenCalled();
		expect(mss.issueCardAfterEntry).not.toHaveBeenCalled();
		wrapper.unmount();
	});

	test('Switching language leaves a card issuance this page retried alone', async () => {
		vi.mocked(mss.enterPubHubs).mockResolvedValue({ key: 'errors.card_not_added', values: ['via email'] });
		vi.mocked(mss.issueCardAfterEntry).mockReturnValue(new Promise(() => {}));

		const wrapper = await mountOnboarding();
		expect(mss.issueCardAfterEntry).toHaveBeenCalledTimes(1);

		switchLanguage();
		await flushPromises();

		expect(mss.issueCardAfterEntry).toHaveBeenCalledTimes(1);
		wrapper.unmount();
	});

	test('Leaving the page ends the attempt', async () => {
		const wrapper = await mountOnboarding();

		wrapper.unmount();

		expect(mss.cancelEnter).toHaveBeenCalled();
	});

	test('The spot the QR code goes in shows a loading state until the widget is there', async () => {
		// Starting a session takes a few requests to PubHubs before the widget is built at all, which on
		// a slow connection leaves that spot empty long enough for the card to look broken.
		const wrapper = await mountOnboarding();
		expect(wrapper.findComponent(InlineSpinner).exists()).toBe(true);

		renderYiviWidget(wrapper);
		await flushPromises();

		expect(wrapper.findComponent(InlineSpinner).exists()).toBe(false);
		wrapper.unmount();
	});

	test('The loading state comes back for the second Yivi session of the two-step flow', async () => {
		// Without chaining the card is issued in a session of its own, built in the same mount point
		// once the disclosure is in, so the spot the QR code goes in is empty again in the meantime.
		const wrapper = await mountOnboarding();
		renderYiviWidget(wrapper);
		await flushPromises();
		expect(wrapper.findComponent(InlineSpinner).exists()).toBe(false);

		mss.issuingCard = true;
		await flushPromises();

		expect(wrapper.findComponent(InlineSpinner).exists()).toBe(true);
		wrapper.unmount();
	});

	test('The loading state stays away while the card is issued in the session already on screen', async () => {
		// A chained session has the card issued in the widget the user is looking at, so there is no
		// second widget to wait for - and covering that one would hide what they have to finish in.
		const wrapper = await mountOnboarding();
		renderYiviWidget(wrapper);
		await flushPromises();

		mss.issuingCard = true;
		mss.issuingCardInSameSession = true;
		await flushPromises();

		expect(wrapper.findComponent(InlineSpinner).exists()).toBe(false);
		wrapper.unmount();
	});

	test('A failed registration offers to try again', async () => {
		vi.mocked(mss.enterPubHubs).mockResolvedValue({ key: 'errors.general_error' });

		const wrapper = await mountOnboarding();

		// The retry takes the spot the QR code had, so the loading state has to be out of the way.
		expect(wrapper.findComponent(InlineSpinner).exists()).toBe(false);
		const retry = wrapper.findComponent(Button);
		expect(retry.exists()).toBe(true);

		retry.vm.$emit('click');
		await flushPromises();

		expect(mss.enterPubHubs).toHaveBeenCalledTimes(2);
		expect(push).not.toHaveBeenCalled();
		wrapper.unmount();
	});

	test('An account whose card never reached the Yivi app is not sent into the app', async () => {
		// The card attribute is on the account and the next login discloses exactly that card, so this
		// cannot be carried into the app with only a line in the log to show for it.
		vi.mocked(mss.enterPubHubs).mockResolvedValue({ key: 'errors.card_not_added', values: ['via email'] });
		vi.mocked(mss.issueCardAfterEntry).mockResolvedValue({ cardAttr: null, errorMessage: { key: 'errors.card_not_added' } });

		const wrapper = await mountOnboarding();

		expect(mss.issueCardAfterEntry).toHaveBeenCalledWith('via email', expect.anything());
		expect(push).not.toHaveBeenCalled();

		// Retrying issues the card on its own: a fresh registration would have to disclose the card
		// that never arrived.
		const retry = wrapper.findComponent(Button);
		expect(retry.exists()).toBe(true);

		retry.vm.$emit('click');
		await flushPromises();

		expect(mss.issueCardAfterEntry).toHaveBeenCalledTimes(2);
		expect(mss.enterPubHubs).toHaveBeenCalledTimes(1);
		wrapper.unmount();
	});

	test('A registration that succeeds leaves onboarding', async () => {
		vi.mocked(mss.enterPubHubs).mockResolvedValue(undefined);

		await mountOnboarding();

		expect(push).toHaveBeenCalledWith({ name: 'hubs-overview' });
	});
});
