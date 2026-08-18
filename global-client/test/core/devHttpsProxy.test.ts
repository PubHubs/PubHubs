import { beforeEach, describe, expect, it, vi } from 'vitest';

// The helper only rewrites inside the native shell, so the gate is mocked per suite below.
const isNativePlatform = vi.fn();
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => isNativePlatform() } }));

const { toDevHttpsProxyUrl } = await import('@global-client/logic/utils/devHttpsProxy');

describe('toDevHttpsProxyUrl in the native shell', () => {
	beforeEach(() => isNativePlatform.mockReturnValue(true));

	it('moves a fronted Matrix API port onto the HTTPS proxy', () => {
		expect(toDevHttpsProxyUrl('http://145.116.167.23:8008/')).toBe('https://145.116.167.23:18008/');
	});

	it('covers every testhub in both fronted ranges', () => {
		expect(toDevHttpsProxyUrl('http://145.116.167.23:8012/')).toBe('https://145.116.167.23:18012/');
		expect(toDevHttpsProxyUrl('http://145.116.167.23:8001/')).toBe('https://145.116.167.23:18001/');
	});

	it('preserves the path', () => {
		expect(toDevHttpsProxyUrl('http://145.116.167.23:8008/_synapse/client/')).toBe('https://145.116.167.23:18008/_synapse/client/');
	});

	// Rewriting an unfronted port would aim at a Caddy address that isn't listening, turning a
	// working plain-HTTP hub into a connection error.
	it('leaves unfronted ports, https URLs and junk alone', () => {
		expect(toDevHttpsProxyUrl('http://145.116.167.23:8013/')).toBe('http://145.116.167.23:8013/');
		expect(toDevHttpsProxyUrl('http://145.116.167.23:5050/')).toBe('http://145.116.167.23:5050/');
		expect(toDevHttpsProxyUrl('http://hub.example.org/')).toBe('http://hub.example.org/');
		expect(toDevHttpsProxyUrl('https://hub.example.org:8008/')).toBe('https://hub.example.org:8008/');
		expect(toDevHttpsProxyUrl('not a url')).toBe('not a url');
	});
});

describe('toDevHttpsProxyUrl outside the native shell', () => {
	it('is a no-op, so web dev and production keep PHC’s address', () => {
		isNativePlatform.mockReturnValue(false);
		expect(toDevHttpsProxyUrl('http://145.116.167.23:8008/')).toBe('http://145.116.167.23:8008/');
	});
});
