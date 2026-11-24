// Packages
import { flushPromises, shallowMount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createI18n } from 'vue-i18n';

// Components
import UserDisplayName from '@hub-client/components/rooms/UserDisplayName.vue';

// Locales
import { en } from '@hub-client/locales/en';

// Stores
import { useUser } from '@hub-client/stores/user';

// The hub is never reached: a test says for itself which accounts are gone.
const ensureKnown = vi.fn(async () => {});
vi.mock('@hub-client/composables/useDeactivatedUsers', () => ({
	useDeactivatedUsers: () => ({ ensureKnown }),
}));

const i18n = createI18n({
	legacy: false,
	warnHtmlMessage: false,
	globalInjection: true,
	locale: 'en',
	fallbackLocale: 'en',
	messages: { en },
});

describe('User Display Name.vue Test', () => {
	// Test variables
	let wrapper;
	const nameSelector = '[data-testid=display-name]';
	const userId = '@123-abc:matrix';

	const mount = (props: Record<string, unknown>) =>
		shallowMount(UserDisplayName, {
			global: { plugins: [i18n] },
			propsData: props,
		});

	// SETUP - run before to each unit test
	beforeEach(() => {
		setActivePinia(createPinia());
		ensureKnown.mockClear();
	});

	test('test member display name is correct', async () => {
		wrapper = mount({ userId, userDisplayName: 'user2', showDisplayName: true });

		// Wait until the DOM updates
		await flushPromises();
		expect(wrapper.find(nameSelector).text()).toEqual('user2');
		await wrapper.setProps({
			user: userId,
			showDisplayName: true,
		});
		expect(wrapper.find(nameSelector).text()).toEqual('user2');
	});

	test('a deleted account is shown as such, without its pseudonym', async () => {
		// The pseudonym is the handle others remember someone by, so it has to go with the
		// account - showing it would keep identifying the person who asked to be gone.
		useUser().setDeactivationResults([userId], [userId]);

		wrapper = mount({ userId, userDisplayName: undefined });
		await flushPromises();

		expect(wrapper.find(nameSelector).text()).toEqual('Deleted account');
		expect(wrapper.text()).not.toContain('123-abc');
	});

	test('a member whose account is not gone keeps their pseudonym', async () => {
		useUser().setDeactivationResults([userId], []);

		wrapper = mount({ userId, userDisplayName: 'user2' });
		await flushPromises();

		expect(wrapper.text()).toContain('123-abc');
	});

	test('only a name we cannot account for is worth asking the hub about', async () => {
		// A member of the room carries a display name; it is the fallback to the Matrix id that
		// gives a deleted account away, so that is the only case worth a request.
		mount({ userId, userDisplayName: 'user2' });
		expect(ensureKnown).not.toHaveBeenCalled();

		mount({ userId, userDisplayName: undefined });
		expect(ensureKnown).toHaveBeenCalledWith([userId]);
	});
});
