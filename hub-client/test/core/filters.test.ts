import { expect, test } from 'vitest';
import filters from '@/core/filters';

test('extractPseudonym', () => {
	expect(filters.extractPseudonym('@12g-gab:matrix')).toBe('12g-gab');
	expect(filters.extractPseudonym('@123456789012345g-g123456789012345:servername')).toBe('123456789012345g-g123456789012345');
	expect(filters.extractPseudonym('@1234567890123456g-g1234567890123456:servername')).toBe('!!!-!!!');

	expect(filters.extractPseudonym('@notices:matrix')).toBe('!!!-!!!');
	expect(filters.extractPseudonym('@system:matrix')).toBe('!!!-!!!');

	expect(filters.extractPseudonym('@g23-abc:matrix')).toBe('!!!-!!!');
	expect(filters.extractPseudonym('@123-agc:matrix')).toBe('!!!-!!!');
	expect(filters.extractPseudonym('@123-abcd:matrix')).toBe('!!!-!!!');

	expect(() => filters.extractPseudonym('acb-123:missing-at')).toThrowError(/^matrix ID did not start with '@'$/);
	expect(() => filters.extractPseudonym('something entirely different')).toThrowError(/^matrix ID did not contain ':'$/);
});

test('localeDateFromTimestamp', () => {
	const timestamp = Date.now();
	expect(filters.localeDateFromTimestamp(timestamp)).toBeTypeOf('string');
});

test('removeBackSlash', () => {
	let url = 'https://main.testhub-matrix.ihub.ru.nl/';
	expect(filters.removeBackSlash(url)).toBeTypeOf('string');
	expect(filters.removeBackSlash(url)).toEqual('https://main.testhub-matrix.ihub.ru.nl');

	url = 'https://main.testhub-matrix.ihub.ru.nl';
	expect(filters.removeBackSlash(url)).toBeTypeOf('string');
	expect(filters.removeBackSlash(url)).toEqual('https://main.testhub-matrix.ihub.ru.nl');
});
