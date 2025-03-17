const sanitize: any = require('sanitize-html');

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

	exclusiveFilter: function (frame: any) {
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

export { removeHtml, hasHtml, sanitizeHtml };
