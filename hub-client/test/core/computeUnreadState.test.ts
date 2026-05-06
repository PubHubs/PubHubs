import { describe, expect, test } from 'vitest';

import { computeUnreadState } from '@hub-client/models/rooms/Room';
import type { StoredUnreadInfo } from '@hub-client/models/rooms/unreadInfoCache';

// Alias for readability: undefined means "not available" (⊥ in the model).
const __ = undefined;

function stored(lastVisibleTs: number, lastReadAllTs?: number): StoredUnreadInfo {
	return lastReadAllTs === undefined ? { lastVisibleTs } : { lastVisibleTs, lastReadAllTs };
}

describe('computeUnreadState', () => {
	// ── Case 1: lastVisibleTs defined (direct evidence) ──

	describe('lastVisibleTs defined', () => {
		test('visible event after receipt → unread', () => {
			expect(computeUnreadState(10, 20, 5, __)).toBe('unread');
		});

		test('visible event at receipt → read', () => {
			expect(computeUnreadState(10, 10, 5, __)).toBe('read');
		});

		test('visible event before receipt → read', () => {
			expect(computeUnreadState(10, 5, 1, __)).toBe('read');
		});

		test('no receipt (0) + visible event → unread', () => {
			expect(computeUnreadState(0, 5, 1, __)).toBe('unread');
		});

		test('stored is irrelevant when lastVisibleTs defined and no cache hit', () => {
			expect(computeUnreadState(10, 5, 1, stored(999))).toBe('read');
			expect(computeUnreadState(10, 20, 5, stored(1))).toBe('unread');
		});

		test('timelineStartTs is irrelevant when lastVisibleTs defined', () => {
			expect(computeUnreadState(10, 5, 999, __)).toBe('read');
			expect(computeUnreadState(10, 20, 1, __)).toBe('unread');
		});
	});

	// ── Case 2: lastVisibleTs ⊥, timelineStartTs defined (no visible event, but timeline loaded) ──

	describe('lastVisibleTs ⊥, timelineStartTs defined', () => {
		test('receipt covers timeline start → read (no blind spot)', () => {
			expect(computeUnreadState(10, __, 5, __)).toBe('read');
			expect(computeUnreadState(10, __, 10, __)).toBe('read');
		});

		test('blind spot + stored evidence of unread → unread', () => {
			expect(computeUnreadState(10, __, 20, stored(15))).toBe('unread');
		});

		test('blind spot + stored covered by receipt → unknown', () => {
			expect(computeUnreadState(10, __, 20, stored(5))).toBe('unknown');
			expect(computeUnreadState(10, __, 20, stored(10))).toBe('unknown');
		});

		test('blind spot + no stored data → unknown', () => {
			expect(computeUnreadState(10, __, 20, __)).toBe('unknown');
		});

		test('room creation (timelineStartTs=0) → read', () => {
			expect(computeUnreadState(0, __, 0, __)).toBe('read');
			expect(computeUnreadState(10, __, 0, __)).toBe('read');
		});
	});

	// ── Case 3: both lastVisibleTs and timelineStartTs ⊥ (empty timeline) ──

	describe('both ⊥ (empty timeline)', () => {
		test('stored evidence of unread → unread', () => {
			expect(computeUnreadState(10, __, __, stored(20))).toBe('unread');
		});

		test('stored covered by receipt → read', () => {
			expect(computeUnreadState(10, __, __, stored(5))).toBe('read');
			expect(computeUnreadState(10, __, __, stored(10))).toBe('read');
		});

		test('lastReadAllTs vouches room was read → read', () => {
			expect(computeUnreadState(0, __, __, stored(0, 50))).toBe('read');
		});

		test('no stored data → unknown', () => {
			expect(computeUnreadState(0, __, __, __)).toBe('unknown');
			expect(computeUnreadState(10, __, __, __)).toBe('unknown');
		});
	});

	// ── lastReadAllTs cache ──

	describe('lastReadAllTs cache', () => {
		test('lastReadAllTs within timeline, no newer visible → read', () => {
			expect(computeUnreadState(5, __, 1, stored(0, 10))).toBe('read');
		});

		test('lastReadAllTs within timeline, visible event older → read', () => {
			expect(computeUnreadState(5, 8, 1, stored(0, 10))).toBe('read');
		});

		test('lastReadAllTs within timeline, visible event newer → falls through to receipt check', () => {
			expect(computeUnreadState(5, 15, 1, stored(0, 10))).toBe('unread');
			expect(computeUnreadState(20, 15, 1, stored(0, 10))).toBe('read');
		});

		test('lastReadAllTs before timeline window → not used as cache', () => {
			// timelineStartTs=20, lastReadAllTs=10: cache doesn't cover the window
			expect(computeUnreadState(5, __, 20, stored(15, 10))).toBe('unread');
		});

		test('lastReadAllTs overrides receiptTs when own messages acted as implicit receipt', () => {
			// receiptTs=5 doesn't cover lastVisibleTs=10, but lastReadAllTs=15 proves
			// the room was read (e.g. user sent a message at ts=12 acting as receipt)
			expect(computeUnreadState(5, 10, 1, stored(0, 15))).toBe('read');
		});
	});
});
