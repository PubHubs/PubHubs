// Packages
import { describe, expect, test } from 'vitest';

// Logic
import { findPowerLevelsContent, powerLevelOf, stateEventPowerLevel } from '@hub-client/logic/utils/powerLevelUtils';

describe('findPowerLevelsContent', () => {
	test('returns the power levels content', () => {
		const content = { users: { A1: 50 } };
		expect(
			findPowerLevelsContent([
				{ type: 'm.room.name', content: { name: 'x' } },
				{ type: 'm.room.power_levels', content },
			]),
		).toBe(content);
	});

	test('returns undefined without a power levels event', () => {
		expect(findPowerLevelsContent([{ type: 'm.room.name', content: { name: 'x' } }])).toBeUndefined();
		expect(findPowerLevelsContent(undefined)).toBeUndefined();
	});
});

describe('powerLevelOf', () => {
	test('uses the explicit user entry', () => {
		expect(powerLevelOf({ users: { A1: 50 }, users_default: 25 }, 'A1')).toEqual(50);
	});

	test('keeps an explicit 0 instead of falling back to users_default', () => {
		expect(powerLevelOf({ users: { A1: 0 }, users_default: 25 }, 'A1')).toEqual(0);
	});

	test('falls back to users_default', () => {
		expect(powerLevelOf({ users: { B2: 100 }, users_default: 25 }, 'A1')).toEqual(25);
	});

	test('falls back to 0 without content or user', () => {
		expect(powerLevelOf(undefined, 'A1')).toEqual(0);
		expect(powerLevelOf({ users: { A1: 50 } }, null)).toEqual(0);
	});
});

describe('stateEventPowerLevel', () => {
	test('uses the level set for the event type', () => {
		expect(stateEventPowerLevel({ events: { 'm.room.power_levels': 100 }, state_default: 50 }, 'm.room.power_levels')).toEqual(100);
	});

	test('falls back to state_default', () => {
		expect(stateEventPowerLevel({ events: { 'm.room.name': 100 }, state_default: 25 }, 'm.room.power_levels')).toEqual(25);
	});

	test("falls back to Matrix's default of 50", () => {
		expect(stateEventPowerLevel({}, 'm.room.power_levels')).toEqual(50);
		expect(stateEventPowerLevel(undefined, 'm.room.power_levels')).toEqual(50);
	});
});
