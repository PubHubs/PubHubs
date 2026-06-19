// Packages
import sanitize from 'sanitize-html';

const removeHtml = (html: string): string => {
	const parsedHTML = new DOMParser().parseFromString(html, 'text/html');
	const text = parsedHTML.body.textContent;

	if (text) {
		if (/(<([^>]+)>)/gi.test(text)) {
			return removeHtml(text);
		}
	}

	return text || '';
};

/**
 * Checks string for Html and removes it when found
 * @param html string to check
 * @returns false if no Html, otherwise cleaned string
 */
const hasHtml = (html: string): boolean | string => {
	const text = removeHtml(html);
	if (text === html) {
		return false;
	}
	return text;
};

// See: https://spec.matrix.org/v1.8/client-server-api/#mroommessage-msgtypes
const sanitizeOptions = {
	allowedTags: [
		'font',
		'del',
		'h1',
		'h2',
		'h3',
		'h4',
		'h5',
		'h6',
		'blockquote',
		'p',
		'a',
		'ul',
		'ol',
		'sup',
		'sub',
		'li',
		'b',
		'i',
		'u',
		'strong',
		'em',
		'strike',
		'code',
		'hr',
		'br',
		'div',
		'table',
		'thead',
		'tbody',
		'tr',
		'th',
		'td',
		'caption',
		'pre',
		'span',
		'img',
		'details',
		'summary',
	],
	allowedAttributes: {
		font: ['data-mx-bg-color', 'data-mx-color', 'color'],
		span: ['data-mx-bg-color', 'data-mx-color', 'data-mx-spoiler', 'class'],
		a: ['name', 'target', 'href', 'rel', 'class'],
		img: ['width', 'height', 'alt', 'title', 'src'],
		ol: ['start'],
		code: ['class'],
	},
	allowedSchemes: ['https', 'http', 'ftp', 'mailto', 'magnet', 'mxc'],
	enforceHtmlBoundary: true,
	nonBooleanAttributes: ['*'],

	exclusiveFilter: function (frame: sanitize.IFrame) {
		// Only allow images with Matrix URL
		if (frame.tag === 'img') {
			if (typeof frame.attribs.src === 'string') {
				if (frame.attribs.src.substring(0, 6) !== 'mxc://') {
					return true;
				}
			}
		}
		return false;
	},

	transformTags: {
		// Add rel="noopener" to all a tags
		a: sanitize.simpleTransform('a', { rel: 'noopener' }),
	},
};

const sanitizeHtml = (html: string): string => {
	html = sanitize(html, sanitizeOptions);
	return html;
};

// Regex patterns for URL detection
// Note: These patterns exclude ~ to avoid matching into mention syntax (@name~id~)
const urlPattern = /\b(?:https?|ftp):\/\/[a-z0-9-+&@#/%?=_|!:,.;]*[a-z0-9-+&@#/%=_|]/gim;
const pseudoUrlPattern = /(^|[^/])(www\.[a-z0-9-+&@#/%?=_|!:,.;]*[a-z0-9-+&@#/%=_|])/gim;
const emailAddressPattern = /(([a-zA-Z0-9_\-.]+)@[a-zA-Z_]+?(?:\.[a-zA-Z]{2,6}))+/gim;

/**
 * Convert plain text to safe HTML with clickable links and line breaks.
 * Use this for rendering user content that hasn't been processed by EventTimeLineHandler.
 *
 * @param text Plain text to convert
 * @returns HTML string safe for use with v-html
 */
const textToHtml = (text: string): string => {
	// First escape HTML entities to prevent XSS
	let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

	// Convert URLs to clickable links
	html = html
		.replace(urlPattern, '<a class="message-link" target="_blank" rel="noopener" href="$&">$&</a>')
		.replace(pseudoUrlPattern, '$1<a class="message-link" target="_blank" rel="noopener" href="http://$2">$2</a>')
		.replace(emailAddressPattern, '<a class="message-link" target="_blank" rel="noopener" href="mailto:$1">$1</a>');

	// Convert newlines to <br/> tags
	html = html.replace(/\n/g, '<br/>');

	return html;
};

export { removeHtml, hasHtml, sanitizeHtml, textToHtml };
