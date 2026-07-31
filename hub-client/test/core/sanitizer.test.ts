// Packages
import { describe, expect, test } from 'vitest';

// Logic
import { escapeHtml, removeHtml, sanitizeHtml } from '@hub-client/logic/core/sanitizer';

describe('removeHTML', () => {
	test('remove HTML', () => {
		const source = '<a href="bla">Bla</a><h1>test</h1><script></script>';
		const clean = removeHtml(source);
		expect(clean).not.toEqual(source);
		expect(clean).toEqual('Blatest');
	});
});

describe('escapeHtml', () => {
	test('escapes markup characters', () => {
		expect(escapeHtml('<b>a & b</b>')).toEqual('&lt;b&gt;a &amp; b&lt;/b&gt;');
	});

	test('an unclosed tag survives sanitizing', () => {
		// `<H|` parses as a tag that only ends at the next `>`, so unescaped it would swallow the rest.
		const source = 'Predicate("100<H| + -50<T|") >= obs1';
		expect(sanitizeHtml(escapeHtml(source))).toEqual('Predicate("100&lt;H| + -50&lt;T|") &gt;= obs1');
	});
});

describe('sanitizeHtml', () => {
	test('link', () => {
		const source = '<a href="bla">Bla</a>';
		const clean = sanitizeHtml(source);
		expect(clean).not.toEqual(source);
		expect(clean).toEqual('<a href="bla" rel="noopener">Bla</a>');
	});

	test('no script', () => {
		const source = 'Lorem ipsum dolor sit amet<script>window.location="https://pubhubs.net"</script>';
		const clean = sanitizeHtml(source);
		expect(clean).not.toEqual(source);
		expect(clean).toEqual('Lorem ipsum dolor sit amet');
	});

	test('no iframe', () => {
		const source = '<iframe src="https://stable.pubhubs.ihub.ru.nl/client#/hub/stable-testhub/!hMHJilXfJAMGFXKNwZ:stable.testhub-matrix.ihub.ru.nl" title="W3Schools Free Online Web Tutorials"></iframe>';
		const clean = sanitizeHtml(source);
		expect(clean).not.toEqual(source);
		expect(clean).toEqual('');
	});

	test('only whithin <html></html>', () => {
		const source = '<head><title>Bla</title></head><html><body>Body</body></html>';
		const clean = sanitizeHtml(source);
		expect(clean).not.toEqual(source);
		expect(clean).toEqual('Body');
	});

	test('no img src', () => {
		const source = 'Hups en flups <img src="https://pubhubs.net/assets/logo.svg">Bla die bla.';
		const clean = sanitizeHtml(source);
		expect(clean).not.toEqual(source);
		expect(clean).toEqual('Hups en flups Bla die bla.');
	});

	test('only matrix img src', () => {
		const source = 'Hups en flups <img src="mxc://img_id_src">Bla die bla.';
		const clean = sanitizeHtml(source);
		expect(clean).toEqual('Hups en flups <img src="mxc://img_id_src" />Bla die bla.');
	});
});
