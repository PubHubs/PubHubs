import { describe, expect, test } from 'vitest';
import { trimSplit } from '@/core/extensions.ts';

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
