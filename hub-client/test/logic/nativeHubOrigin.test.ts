import { describe, expect, test } from 'vitest';

import { assertNativeHubOriginMatchesHubId, nativeHubLabel, nativeHubOrigin } from '@hub-client/logic/utils/nativeHubOrigin';

// Same vectors as pubhubs_hub/test/native_app_test.py, so both sides derive the same label.
const HUB_ID = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8'; // bytes 0..31
const LABEL = 'aaaqeayeaudaocajbifqydiob4ibceqtcqkrmfyydenbwha5dypq';
const HOST = `${LABEL}.hubs.pubhubs-app.invalid`;

describe('nativeHubLabel', () => {
	test('matches the known vectors', () => {
		expect(nativeHubLabel(HUB_ID)).toBe(LABEL);
		expect(nativeHubLabel('__________________________________________8')).toBe('777777777777777777777777777777777777777777777777777q');
	});

	test('is a valid lowercase hostname label', () => {
		expect(nativeHubLabel(HUB_ID)).toMatch(/^[a-z2-7]{52}$/);
	});

	test('rejects anything that is not a 32-byte base64url id', () => {
		expect(() => nativeHubLabel('AAEC')).toThrow();
		expect(() => nativeHubLabel(HUB_ID + 'A')).toThrow();
		expect(() => nativeHubLabel(HUB_ID.replace('A', '+'))).toThrow();
	});
});

describe('nativeHubOrigin', () => {
	test('uses the app shell scheme', () => {
		expect(nativeHubOrigin(HUB_ID, 'https:')).toBe(`https://${HOST}`);
		expect(nativeHubOrigin(HUB_ID, 'capacitor:')).toBe(`capacitor://${HOST}`);
	});
});

describe('assertNativeHubOriginMatchesHubId', () => {
	test('accepts the origin of its own hub', () => {
		expect(() => assertNativeHubOriginMatchesHubId(HOST, HUB_ID)).not.toThrow();
	});

	test('ignores hosts that are not native hub hosts', () => {
		expect(() => assertNativeHubOriginMatchesHubId('localhost', null)).not.toThrow();
		expect(() => assertNativeHubOriginMatchesHubId('hub.example.org', 'whatever')).not.toThrow();
	});

	test('refuses another hub id, a missing one, or a malformed one', () => {
		expect(() => assertNativeHubOriginMatchesHubId(HOST, '__________________________________________8')).toThrow();
		expect(() => assertNativeHubOriginMatchesHubId(HOST, null)).toThrow();
		expect(() => assertNativeHubOriginMatchesHubId(HOST, 'not-an-id')).toThrow();
	});
});
