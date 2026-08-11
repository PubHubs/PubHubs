// Packages
import { shallowMount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test } from 'vitest';

// Components
import MessageBodyWithMentions from '@hub-client/components/rooms/MessageBodyWithMentions.vue';
import PrivilegedMessageBody from '@hub-client/components/rooms/PrivilegedMessageBody.vue';

const mountWithContent = (content: Record<string, unknown>) =>
	shallowMount(PrivilegedMessageBody, {
		props: { event: { msgtype: 'pubhubs.announcement_message', ...content } as any },
	});

describe('PrivilegedMessageBody', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	// Announcements and whispers used to be rendered by a private <p v-safe-html="body">, which missed
	// every improvement made to the regular message path (escaping, links, line breaks, mentions).
	// They now go through the shared renderer, so this only has to assert the wiring.
	test('renders the body through the shared message body renderer', () => {
		const wrapper = mountWithContent({ body: 'plain text', ph_body: 'processed html' });
		const shared = wrapper.findComponent(MessageBodyWithMentions);

		expect(shared.exists()).toBe(true);
		expect(shared.props('body')).toEqual('plain text');
		expect(shared.props('phBody')).toEqual('processed html');
	});

	test('passes an absent ph_body through as undefined', () => {
		const shared = mountWithContent({ body: 'plain text' }).findComponent(MessageBodyWithMentions);

		expect(shared.props('body')).toEqual('plain text');
		expect(shared.props('phBody')).toBeUndefined();
	});
});
