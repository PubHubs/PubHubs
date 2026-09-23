// These helpers deliberately live apart from sanitizer.ts: none of them needs sanitize-html,
// and sanitize-html pulls postcss in with it — together ~245 KB. Keeping them here means the
// message pipeline and the miniclient, which only ever escape or strip, do not carry a full
// HTML sanitizer they never call.

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
 * Escapes the characters that would otherwise be parsed as markup, so plain text survives verbatim.
 * Without this, an HTML parser consumes everything from a literal `<` up to the next `>` as a tag and
 * drops it, which silently deletes pasted code, math and generics.
 * @param text Plain text to escape
 */
const escapeHtml = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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
	let html = escapeHtml(text);

	// Convert URLs to clickable links
	html = html
		.replace(urlPattern, '<a class="message-link" target="_blank" rel="noopener" href="$&">$&</a>')
		.replace(pseudoUrlPattern, '$1<a class="message-link" target="_blank" rel="noopener" href="http://$2">$2</a>')
		.replace(emailAddressPattern, '<a class="message-link" target="_blank" rel="noopener" href="mailto:$1">$1</a>');

	// Convert newlines to <br/> tags
	html = html.replace(/\n/g, '<br/>');

	return html;
};

export { removeHtml, escapeHtml, textToHtml };
