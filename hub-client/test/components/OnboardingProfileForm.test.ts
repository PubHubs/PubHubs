// Packages
import { createTestingPinia } from '@pinia/testing';
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { createI18n } from 'vue-i18n';

// Components
import OnboardingProfileForm from '@hub-client/components/forms/OnboardingProfileForm.vue';

import { en } from '@hub-client/locales/en';
import { nl } from '@hub-client/locales/nl';

const PREVIEW_NAME = '[data-testid="display-name"]';
const ERROR = '.field-validation-error';

describe('OnboardingProfileForm.vue', () => {
	let wrapper;

	beforeEach(() => {
		globalThis.URL.createObjectURL = () => 'blob:preview';
		globalThis.URL.revokeObjectURL = () => {};

		const i18n = createI18n({
			legacy: false,
			warnHtmlMessage: false,
			globalInjection: true,
			locale: 'en',
			fallbackLocale: 'en',
			messages: { nl, en },
		});

		wrapper = mount(OnboardingProfileForm, {
			props: { pseudonym: 'abc-123', modelValue: '', avatarFile: null },
			global: {
				plugins: [i18n, createTestingPinia({ initialState: { user: { userId: '@abc-123:test' } } })],
			},
		});
	});

	afterEach(() => {
		wrapper.unmount();
	});

	test('shows no preview until something is chosen', () => {
		expect(wrapper.find(PREVIEW_NAME).exists()).toBe(false);
	});

	test('shows the preview with the chosen name', async () => {
		await wrapper.setProps({ modelValue: 'Alice' });
		expect(wrapper.find(PREVIEW_NAME).text()).toBe('Alice');
	});

	test('shows the preview with the pseudonym when only an avatar is chosen', async () => {
		await wrapper.setProps({ avatarFile: new File(['x'], 'avatar.png', { type: 'image/png' }) });
		expect(wrapper.find(PREVIEW_NAME).text()).toBe('abc-123');
		expect(wrapper.find('[data-testid="avatar"]').attributes('src')).toBe('blob:preview');
	});

	test('ignores surrounding whitespace in the name', async () => {
		await wrapper.setProps({ modelValue: '   ' });
		expect(wrapper.find(PREVIEW_NAME).exists()).toBe(false);
	});

	test('shows a length error only while a too short name is filled in', async () => {
		const input = wrapper.find('input[type="text"]');
		await input.setValue('ab');
		expect(wrapper.find(ERROR).exists()).toBe(true);

		// Clearing the field means keeping the pseudonym, which is allowed
		await input.setValue('');
		expect(wrapper.find(ERROR).exists()).toBe(false);

		await input.setValue('  ab  ');
		expect(wrapper.find(ERROR).exists()).toBe(true);
	});

	test('emits submit on enter in the name field', async () => {
		await wrapper.find('input[type="text"]').trigger('keydown', { key: 'Enter' });
		expect(wrapper.emitted('submit')).toHaveLength(1);
	});

	test('gives the name field and the avatar button an accessible name', () => {
		const input = wrapper.find('input[type="text"]');
		expect(wrapper.find(`label[for="${input.attributes('id')}"]`).text()).toBe(en.settings.displayname);
		expect(wrapper.find('button').attributes('aria-label')).toBe(en.onboarding.username_change_avatar);
	});
});
