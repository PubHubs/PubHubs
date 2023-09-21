const sanitize: any = require('sanitize-html');

const createLinks = (text: string) => {
	const aTag = '<a target="_blank" class="text-green" ';
	// http://, https://, ftp://
	const urlPattern = /\b(?:https?|ftp):\/\/[a-z0-9-+&@#/%?=~_|!:,.;]*[a-z0-9-+&@#/%=~_|]/gim;
	// www. sans http:// or https://
	const pseudoUrlPattern = /(^|[^/])(www\.[\S]+(\b|$))/gim;
	// Email addresses
	const emailAddressPattern = /(([a-zA-Z0-9_\-.]+)@[a-zA-Z_]+?(?:\.[a-zA-Z]{2,6}))+/gim;
	return text
		.replace(urlPattern, aTag + 'href="$&">$&</a>')
		.replace(pseudoUrlPattern, '$1' + aTag + 'href="http://$2">$2</a>')
		.replace(emailAddressPattern, aTag + 'href="mailto:$1">$1</a>');
};

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

const hasHtml = (html: string): boolean | string => {
	const text = removeHtml(html);
	if (text == html) {
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
		span: ['data-mx-bg-color', 'data-mx-color', 'data-mx-spoiler'],
		a: ['name', 'target', 'href', 'rel'],
		img: ['width', 'height', 'alt', 'title', 'src'],
		ol: ['start'],
		code: ['class'],
	},
	allowedSchemes: ['https', 'http', 'ftp', 'mailto', 'magnet', 'mxc'],
	enforceHtmlBoundary: true,
	nonBooleanAttributes: ['*'],

	exclusiveFilter: function (frame: any) {
		// Only allow images with Matrix URL
		if (frame.tag == 'img') {
			if (typeof frame.attribs.src == 'string') {
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

export { createLinks, removeHtml, hasHtml, sanitizeHtml };
