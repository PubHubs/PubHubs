// Packages
import sanitize, { type IOptions as SanitizeOptions } from 'sanitize-html';

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

const sanitizeHtml = (html: string, extraOptions?: SanitizeOptions): string => {
	if (extraOptions) {
		const merged: SanitizeOptions = {
			...sanitizeOptions,
			...extraOptions,
			// Always preserve security-critical settings from the base config
			exclusiveFilter: sanitizeOptions.exclusiveFilter,
			transformTags: sanitizeOptions.transformTags,
		};
		return sanitize(html, merged);
	}
	return sanitize(html, sanitizeOptions);
};

export { sanitizeHtml };
