import { describe, expect, test } from 'vitest';
import { trimSplit, isEmpty } from '@/core/extensions.ts';

describe('isEmpty', () => {
	test('boolean', () => {
		expect(isEmpty(false)).toBeTypeOf('boolean');
		expect(isEmpty(false)).toEqual(true);
		expect(isEmpty(true)).toBeTypeOf('boolean');
		expect(isEmpty(true)).toEqual(false);
	});
	test('string', () => {
		expect(isEmpty('')).toBeTypeOf('boolean');
		expect(isEmpty('')).toEqual(true);
		expect(isEmpty('jahb')).toBeTypeOf('boolean');
		expect(isEmpty('akdfj')).toEqual(false);
	});
	test('Object', () => {
		expect(isEmpty({})).toBeTypeOf('boolean');
		expect(isEmpty({})).toEqual(true);
		expect(isEmpty({ test: 'test' })).toBeTypeOf('boolean');
		expect(isEmpty({ test: 'test' })).toEqual(false);
	});
});

describe('trimSplit', () => {
	test('empty', () => {
		const source = '';
		const list = trimSplit(source);

		expect(list).toBeTypeOf('object');
		expect(list).toEqual([]);
	});

	test('empty spaces', () => {
		const source = '  ';
		const list = trimSplit(source);

		expect(list).toBeTypeOf('object');
		expect(list).toEqual([]);
	});

	test('normal', () => {
		const source = 'a,b,c';
		const list = trimSplit(source);

		expect(list).toBeTypeOf('object');
		expect(list).toHaveLength(3);
		expect(list).toEqual(['a', 'b', 'c']);
	});

	test('spaces', () => {
		const source = ' a, b, c ';
		const list = trimSplit(source);

		expect(list).toBeTypeOf('object');
		expect(list).toHaveLength(3);
		expect(list).toEqual(['a', 'b', 'c']);
	});

	test('more delimiters', () => {
		const source = ' a, , b,c';
		const list = trimSplit(source);

		expect(list).toHaveLength(3);
		expect(list).toEqual(['a', 'b', 'c']);
	});

	test('stranges chars', () => {
		const source = '  test, bla@hups.nl , , http://sfd.nl, U-67657';
		const list = trimSplit(source);

		expect(list).toHaveLength(4);
		expect(list).toEqual(['test', 'bla@hups.nl', 'http://sfd.nl', 'U-67657']);
	});
});
