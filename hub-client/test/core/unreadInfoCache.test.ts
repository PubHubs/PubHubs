import { describe, expect, test } from 'vitest';

import { type StoredUnreadInfo, mergeStoredUnreadInfo } from '@hub-client/models/rooms/unreadInfoCache';

function info(lastVisibleTs: number, lastReadAllTs?: number): StoredUnreadInfo {
	return lastReadAllTs === undefined ? { lastVisibleTs } : { lastVisibleTs, lastReadAllTs };
}

// Cover both ends of the optional field for lastReadAllTs by mixing defined
// and undefined values across operands.
const VARIANTS: StoredUnreadInfo[] = [
	info(0),
	info(0, 0),
	info(5),
	info(5, 5),
	info(5, 10),
	info(10, 5),
	info(10),
	info(100, 50),
	info(50, 100),
];

describe('mergeStoredUnreadInfo', () => {
	test('is associative for every triple of variants', () => {
		for (const a of VARIANTS) {
			for (const b of VARIANTS) {
				for (const c of VARIANTS) {
					const left = mergeStoredUnreadInfo(mergeStoredUnreadInfo(a, b), c);
					const right = mergeStoredUnreadInfo(a, mergeStoredUnreadInfo(b, c));
					expect(left, `(${desc(a)} * ${desc(b)}) * ${desc(c)} != ${desc(a)} * (${desc(b)} * ${desc(c)})`).toEqual(right);
				}
			}
		}
	});

	test('is commutative for every pair of variants', () => {
		for (const a of VARIANTS) {
			for (const b of VARIANTS) {
				const ab = mergeStoredUnreadInfo(a, b);
				const ba = mergeStoredUnreadInfo(b, a);
				expect(ab, `${desc(a)} * ${desc(b)} != ${desc(b)} * ${desc(a)}`).toEqual(ba);
			}
		}
	});

	test('lastVisibleTs always advances via max', () => {
		expect(mergeStoredUnreadInfo(info(10), info(5)).lastVisibleTs).toBe(10);
		expect(mergeStoredUnreadInfo(info(5), info(10)).lastVisibleTs).toBe(10);
		expect(mergeStoredUnreadInfo(info(5), info(5)).lastVisibleTs).toBe(5);
	});

	test('lastReadAllTs: undefined acts as identity (does not override defined)', () => {
		expect(mergeStoredUnreadInfo(info(0, 5), info(0)).lastReadAllTs).toBe(5);
		expect(mergeStoredUnreadInfo(info(0), info(0, 5)).lastReadAllTs).toBe(5);
	});

	test('lastReadAllTs: both defined → max', () => {
		expect(mergeStoredUnreadInfo(info(0, 5), info(0, 10)).lastReadAllTs).toBe(10);
		expect(mergeStoredUnreadInfo(info(0, 10), info(0, 5)).lastReadAllTs).toBe(10);
	});

	test('lastReadAllTs: both undefined → undefined', () => {
		expect(mergeStoredUnreadInfo(info(0), info(0)).lastReadAllTs).toBeUndefined();
	});
});

function desc(x: StoredUnreadInfo): string {
	return `(lvTs=${x.lastVisibleTs}, lraTs=${x.lastReadAllTs ?? 'undef'})`;
}
