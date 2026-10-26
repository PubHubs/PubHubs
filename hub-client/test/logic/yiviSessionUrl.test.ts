import { SessionManagement } from '@privacybydesign/yivi-client';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { allowInsecureYiviSessionUrlsInDev } from '@hub-client/logic/utils/yiviSessionUrl';

import { useSettings } from '@hub-client/stores/settings';

const assertSafe = (url: string) =>
	(SessionManagement.prototype as unknown as { _assertSafeSessionUrl: (url: string) => void })._assertSafeSessionUrl.call({}, url);

const DEV_SESSION_URL = 'http://192.168.1.10:8188/irma/session/abc';

describe('allowInsecureYiviSessionUrlsInDev', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.stubEnv('DEV', false);
		allowInsecureYiviSessionUrlsInDev();
		allowInsecureYiviSessionUrlsInDev(); // installing twice must not stack
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	test('keeps the strict check outside dev and native debug builds', () => {
		expect(() => assertSafe(DEV_SESSION_URL)).toThrow();
	});

	test('allows a plain-http session url once the parent reports a native debug build', () => {
		useSettings().setIsNativeDebugApp(true);
		expect(() => assertSafe(DEV_SESSION_URL)).not.toThrow();
		expect(() => assertSafe('javascript:alert(1)')).toThrow();
	});

	test('allows a plain-http session url in dev', () => {
		vi.stubEnv('DEV', true);
		expect(() => assertSafe(DEV_SESSION_URL)).not.toThrow();
	});
});
