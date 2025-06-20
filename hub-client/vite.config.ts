/// <reference types="vitest" />

import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import Vue from '@vitejs/plugin-vue';
import path from 'node:path';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
	server: {
		port: 8081,
		strictPort: true,
	},
	plugins: [Vue(), nodePolyfills()],
	test: {
		root: './',
		globals: true,
		environment: 'jsdom',
		setupFiles: ['./test/setup-teardown-hooks.ts'],
	},
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url)),
			process: 'process/browser',
			vue: path.resolve(__dirname, 'node_modules/vue'),
			pinia: path.resolve(__dirname, 'node_modules/pinia'),
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
