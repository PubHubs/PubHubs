import tailwindcss from '@tailwindcss/vite';
import Vue from '@vitejs/plugin-vue';
import { URL, fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
	logLevel: 'warn',
	server: {
		strictPort: true,
	},
	plugins: [nodePolyfills(), tailwindcss(), Vue()],
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
	resolve: {
		alias: {
			'@hub-client': fileURLToPath(new URL('./src', import.meta.url)),
			process: 'process/browser',
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
