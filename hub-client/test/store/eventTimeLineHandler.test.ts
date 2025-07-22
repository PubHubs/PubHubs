import { setActivePinia, createPinia } from 'pinia';
import { describe, beforeEach, expect, test } from 'vitest';
import { EventTimeLineHandler } from '@/logic/core/eventTimeLineHandler';
import { TEvent } from '@/logic/core/model/event/TEvent';
import { TTextMessageEventContent } from '@/logic/core/model/events/TMessageEvent';
import { EventType } from 'matrix-js-sdk';
// import { usePlugins, MenuPluginProperties,RoomIdPluginProperties,TypePluginProperties, PluginType } from '@/logic/store/plugins';

const TestEvent = {
	type: EventType.RoomMessage,
	room_id: '##room_id##',
	content: {
		body: `<h2>Lorem ipsum dolor sit amet</h2>
        <script>alert('alert');</script>
        <iframe src="www.pubhubs.net"></iframe>
        <img src="www.pubhubs.net">
        <p>Consectetur adipiscing elit. Vivamus in www.link.nl ac justo @User - 1234-5678aluctus sodales vel justo. Integer @blandit - 123-456, quam id@Test - 363-8a5 porttitor consequat.</p>
        `,
		msgtype: 'm.text',
	} as TTextMessageEventContent,
} as TEvent;

const TestEventLink = {
	type: EventType.RoomMessage,
	room_id: '##room_id##',
	content: {
		body: `
        @Bram 12 - a04-250 <a target="_blank" class="text-green" href="https://webkit.org/blog/8124/introducing-storage-access-api/">https://webkit.org/blog/8124/introducing-storage-access-api/</a>
        `,
		msgtype: 'm.text',
	} as TTextMessageEventContent,
};

const timelineHandler = new EventTimeLineHandler();

describe('EventTimeLineHandler', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	describe('default', () => {
		test('default situation', () => {
			expect(timelineHandler).toBeTypeOf('object');
		});

		test('handle simple event', () => {
			const event = timelineHandler.transformEventContent(TestEvent);
			expect(event).toBeTypeOf('object');
			expect(event).toHaveProperty('content');
			const content = event.content;
			expect(content).toHaveProperty('ph_body');

			// Has linebreaks
			expect(TestEvent.content.body.indexOf('<br')).toBe(-1);
			expect(content.ph_body.indexOf('<br')).toBeGreaterThan(0);

			// Has links
			expect(TestEvent.content.body.indexOf('<a')).toBe(-1);
			expect(content.ph_body.indexOf('<a class="message-link')).toBeGreaterThan(0);
			const eventLink = timelineHandler.transformEventContent(TestEventLink);
			expect(TestEventLink.content.body.match(/<a/g).length).toBe(1);
			expect(eventLink.content.ph_body.match(/<a/g).length).toBe(1);

			// Has Mentions
			expect(TestEvent.content.body.indexOf('<span class="message-mention')).toBe(-1);
			expect(content.ph_body.match(/<span class="message-mention/g).length).toBe(3);

			// Sanitized
			expect(content.ph_body.indexOf('<script')).toBe(-1); // no scripts
			expect(content.ph_body.indexOf('<iframe')).toBe(-1); // no iframes
			expect(content.ph_body.indexOf('<img')).toBe(-1); // no images
		});
	});
});
