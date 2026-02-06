// Packages
import { vi } from 'vitest';

// @ts-expect-error
global._env = {
	PUBHUBS_URL: 'http://test',
	PHC_URL: 'http://test',
	HUB_URL: 'http://test',
};

/**
 * Mocks the window.matchMedia function.
 * @since 11 Dec 2024
 * @author matheusgomes062
 * @see https://github.com/vitest-dev/vitest/issues/821#issuecomment-1046954558
 */
Object.defineProperty(window, 'matchMedia', {
	writable: true,
	value: vi.fn().mockImplementation((query) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(), // deprecated
		removeListener: vi.fn(), // deprecated
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	})),
});
