// Packages
import { describe, expect, test } from 'vitest';

// Files allowed to contain v-html (with documented reason)
const ALLOWLIST = new Set([
	'src/components/elements/Icon.vue', // static SVG icon assets, no user input here, only hard coded svg's, so it's safe – eslint-disable comment present
]);

// Load all .vue file contents via Vite glob
const vueFiles = import.meta.glob('../../src/**/*.vue', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

describe('security: no v-html', () => {
	test('v-html must not appear in .vue files outside the allowlist', () => {
		const violations: string[] = [];

		for (const [rawPath, content] of Object.entries(vueFiles)) {
			// Normalise "../../src/foo/bar.vue" → "src/foo/bar.vue"
			const rel = rawPath.replace(/^.*?(src\/)/, 'src/');
			if (ALLOWLIST.has(rel)) continue;

			if (/v-html/.test(content)) {
				violations.push(rel);
			}
		}

		expect(violations, `v-html found in files outside the allowlist — use v-safe-html instead:\n${violations.join('\n')}`).toHaveLength(0);
	});
});
