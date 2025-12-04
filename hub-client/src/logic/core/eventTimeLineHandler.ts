// Models
// Logic
import { sanitizeHtml } from '@hub-client/logic/core/sanitizer';

import { TEvent } from '@hub-client/models/events/TEvent';
import { TTextMessageEventContent } from '@hub-client/models/events/TMessageEvent';

/**
 * This class handles all changes that should be made to incoming timeline events
 * In future Matrix spec some refacturing is needed: https://github.com/matrix-org/matrix-spec-proposals/blob/main/proposals/1767-extensible-events.md
 */

// Tags for mentions
const startMentionTag = '<span class="message-mention">';
const endMentionTag = '</span>';

// Tag for links
const linkTag = '<a class="message-link" target="_blank" ';
const endLinkTag = '</a>';

// Regex for replacing urls with clickable links
const removeLinkTagsPattern = /<a.*?href="([^"]*?)"[^>]*?>.*?<\/a\s*?>/gi;
const urlPattern = /\b(?:https?|ftp):\/\/[a-z0-9-+&@#/%?=~_|!:,.;]*[a-z0-9-+&@#/%=~_|]/gim; // http://, https://, ftp://
const pseudoUrlPattern = /(^|[^/])(www\.[\S]+(\b|$))/gim; // www. sans http:// or https://
const emailAddressPattern = /(([a-zA-Z0-9_\-.]+)@[a-zA-Z_]+?(?:\.[a-zA-Z]{2,6}))+/gim; // Email addresses

// Regex for replacing mentions (pseudonym with 2*3-6 digits, in theory the pseudonym could go up to 2*14 digits, but 6 should be good enough for this purpose)
const mentionsPattern = /(@([^@]*\s)?([0-9a-f]{3}?-[0-9a-f]{3}?|[0-9a-f]{4}?-[0-9a-f]{4}?|[0-9a-f]{5}?-[0-9a-f]{5}?|[0-9a-f]{6}?-[0-9a-f]{6}?))/g;

class EventTimeLineHandler {
	// Core method that will call all others
	public transformEventContent(event: Partial<TEvent>) {
		const eventContent = event.content as TTextMessageEventContent;
		eventContent.ph_body = eventContent.body;

		if (eventContent.msgtype === 'm.text') {
			if (typeof eventContent.format === 'string') {
				if (eventContent.format === 'org.matrix.custom.html' && typeof eventContent.formatted_body === 'string') {
					eventContent.ph_body = eventContent.formatted_body;
				}
			}
		}

		eventContent.ph_body = this.createClickableLinks(eventContent.ph_body!);
		eventContent.ph_body = this.addMentions(eventContent.ph_body);
		eventContent.ph_body = this.addLineBreaks(eventContent.ph_body);
		eventContent.ph_body = this.sanitizeEventContent(eventContent.ph_body);
		return event;
	}

	private createClickableLinks(body: string) {
		// first remove current <a tags, so no doubles are created and all of them have same styling
		body = body.replace(removeLinkTagsPattern, '$1');
		// transform all flat links to PubHubs specific link tag.
		return body
			.replace(urlPattern, linkTag + 'href="$&">$&' + endLinkTag)
			.replace(pseudoUrlPattern, '$1' + linkTag + 'href="http://$2">$2' + endLinkTag)
			.replace(emailAddressPattern, linkTag + 'href="mailto:$1">$1' + endLinkTag);
	}

	private addMentions(body: string) {
		// First test if there is an @ in body
		if (body.match(/^@|\s'@/)) {
			// If so, replace them with mentions, except email-addresses
			body = body.replace(mentionsPattern, startMentionTag + '$1' + endMentionTag);
		}
		return body;
	}

	private addLineBreaks(body: string) {
		body = body.replace(/\r?\n/g, '<br/>');
		return body;
	}

	private sanitizeEventContent(body: string) {
		body = sanitizeHtml(body);
		return body;
	}
}

export { EventTimeLineHandler };
