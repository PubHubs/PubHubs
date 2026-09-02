import tailwindcss from '@tailwindcss/vite';
import Vue from '@vitejs/plugin-vue';
import { execSync } from 'node:child_process';
import { URL, fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { defineConfig } from 'vitest/config';

// The version shown in the about dialog and written to dist/version.txt.  CI sets PH_VERSION to the
// release tag it is building; locally we describe the checkout, so a dev build reports what it was
// actually built from.
let version = process.env.PH_VERSION ?? '';
if (!version) {
	try {
		version = execSync('git describe --tags', { stdio: ['ignore', 'pipe', 'ignore'] })
			.toString()
			.trim();
	} catch {
		version = 'unknown';
	}
}

// Puts the version in a plain file next to the bundle, so `docker exec <ctr> cat
// /usr/var/static/version.txt` answers which client version an image is running -- the bundle itself
// only carries it as a minified string literal.
const emitVersionFile: Plugin = {
	name: 'ph-emit-version',
	generateBundle() {
		this.emitFile({ type: 'asset', fileName: 'version.txt', source: `${version}\n` });
	},
};

export default defineConfig({
	logLevel: 'warn',
	define: {
		__APP_VERSION__: JSON.stringify(version),
	},
	server: {
		strictPort: true,
	},
	plugins: [nodePolyfills({ exclude: ['crypto'] }), tailwindcss(), Vue(), emitVersionFile],
	test: {
		root: './',
		globals: true,
		environment: 'jsdom',
		setupFiles: ['./test/setup-teardown-hooks.ts'],
		onConsoleLog(log: string) {
			if (log.includes('Expected Room, got Object')) return false;
			if (log.includes('Failed to resolve directive')) return false;
		},
	},
	optimizeDeps: {
		exclude: ['vue-i18n'],
	},
	resolve: {
		alias: {
			'@hub-client': fileURLToPath(new URL('./src', import.meta.url)),
			'vue-i18n': 'vue-i18n/dist/vue-i18n.esm-bundler.js',
		},
	},
	build: {
		rollupOptions: {
			input: {
				index: 'index.html',
				miniclient: 'miniclient.html',
			},
			output: {
				entryFileNames: '[name].[hash].js',
			},
		},
	},
});
