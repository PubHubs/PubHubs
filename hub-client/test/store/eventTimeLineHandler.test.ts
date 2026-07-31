// Packages
import { EventType } from 'matrix-js-sdk';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test } from 'vitest';

// Logic
import { EventTimeLineHandler } from '@hub-client/logic/core/eventTimeLineHandler';
import { sanitizeHtml } from '@hub-client/logic/core/sanitizer';

// Models
import { type TTextMessageEventContent } from '@hub-client/models/events/TMessageEvent';

// Stores
import { type TEvent } from '@hub-client/stores/rooms';

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

// A formatted message (as sent by other Matrix clients): its markup is used as-is, so an existing
// link must not be turned into a nested one.
const TestEventLink = {
	type: EventType.RoomMessage,
	room_id: '##room_id##',
	content: {
		body: `
        @Bram 12 - a04-250 https://webkit.org/blog/8124/introducing-storage-access-api/
        `,
		format: 'org.matrix.custom.html',
		formatted_body: `
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
			expect(TestEventLink.content.formatted_body.match(/<a/g).length).toBe(1);
			expect(eventLink.content.ph_body.match(/<a/g).length).toBe(1);

			// Has Mentions
			expect(TestEvent.content.body.indexOf('<span class="message-mention')).toBe(-1);
			// expect(content.ph_body.match(/<span class="message-mention/g).length).toBe(3);

			// Sanitized - not needed -> moved to v-safe-html directive
			// expect(content.ph_body.indexOf('<script')).toBe(-1); // no scripts
			// expect(content.ph_body.indexOf('<iframe')).toBe(-1); // no iframes
			// expect(content.ph_body.indexOf('<img')).toBe(-1); // no images
		});
	});

	describe('plain text bodies', () => {
		// Regression: a plain text body is not markup. Passing it through unescaped let the sanitizer
		// (v-safe-html) eat everything between a literal `<` and the next `>` - here five lines of a
		// pasted code sample, because `<H|` parses as an unclosed tag.
		test('pasted code containing < survives', () => {
			const source = [
				'obs1 = Predicate("100<H| + -50<T|")',
				'obs2 = Predicate("100<H| + 50<T|")',
				'# same outcomes:',
				'print( flip(Fraction(3,10)) >= obs1 )',
			].join('\n');
			const event = timelineHandler.transformEventContent({
				type: EventType.RoomMessage,
				room_id: '##room_id##',
				content: { body: source, msgtype: 'm.text' } as TTextMessageEventContent,
			} as TEvent);

			const phBody = event.content.ph_body;
			expect(phBody).toContain('Predicate("100&lt;H| + -50&lt;T|")');
			expect(phBody).toContain('# same outcomes:');
			expect(phBody).toContain('flip(Fraction(3,10)) &gt;= obs1');
			expect(phBody).not.toContain('<H|');

			// And it stays intact once the sanitizer has run over it.
			expect(sanitizeHtml(phBody)).toContain('Predicate("100&lt;H| + -50&lt;T|")');
		});

		test('typed markup is displayed literally, not applied', () => {
			const event = timelineHandler.transformEventContent({
				type: EventType.RoomMessage,
				room_id: '##room_id##',
				content: { body: '<b>Lorem</b> & <script>alert(1)</script>', msgtype: 'm.text' } as TTextMessageEventContent,
			} as TEvent);

			expect(event.content.ph_body).toBe('&lt;b&gt;Lorem&lt;/b&gt; &amp; &lt;script&gt;alert(1)&lt;/script&gt;');
			expect(sanitizeHtml(event.content.ph_body)).not.toContain('<script');
		});
	});
});
