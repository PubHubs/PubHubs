// Packages
import { shallowMount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { RouterLink, createRouter, createWebHistory } from 'vue-router';

// Components
import AuthHeader from '@global-client/components/ui/onboarding/AuthHeader.vue';

// Logic
import { routes } from '@global-client/logic/core/routes';

import { setUpi18n } from '@hub-client/i18n';

describe('AuthHeader.vue', () => {
	const originalPhcUrl = _env.PHC_URL;

	const mountHeader = () => {
		const router = createRouter({ history: createWebHistory(), routes });
		return shallowMount(AuthHeader, { global: { plugins: [router, setUpi18n()] } });
	};

	beforeEach(() => {
		setActivePinia(createPinia());
	});

	afterEach(() => {
		_env.PHC_URL = originalPhcUrl;
		delete _env.REVIEW_PHC_URL;
		localStorage.clear();
		vi.unstubAllGlobals();
	});

	// Not to the website, and in the app not out of the app either.
	test('The logo leads to the login page', () => {
		const wrapper = mountHeader();

		expect(wrapper.findComponent(RouterLink).props('to')).toEqual({ name: 'login' });
	});

	test('Shows nothing about review mode outside it', () => {
		const wrapper = mountHeader();

		expect(wrapper.find('button').exists()).toBe(false);
	});

	test('In review mode, says so and lets the user leave it', async () => {
		_env.REVIEW_PHC_URL = 'https://phc-review.example';
		_env.PHC_URL = _env.REVIEW_PHC_URL;
		localStorage.setItem('ph:review-mode', '1');
		const location = { hash: '', reload: vi.fn() };
		vi.stubGlobal('location', location);
		const wrapper = mountHeader();

		await wrapper.find('button').trigger('click');

		expect(localStorage.getItem('ph:review-mode')).toBeNull();
		expect(location.hash).toBe('/login');
		expect(location.reload).toHaveBeenCalledTimes(1);
	});
});
