/// <reference types="vitest" />

import { defineConfig } from 'vite';
import { alias } from './alias';
import Vue from '@vitejs/plugin-vue';

export default defineConfig({
	plugins: [
		Vue({
			template: {
				compilerOptions: {
					isCustomElement: (tag) => ['Icon'].includes(tag),
				},
			},
		}),
	],
	test: {
		root: './',
		globals: true,
		environment: 'jsdom',
		setupFiles: ['./test/setup-teardown-hooks.ts'],
		// Remove this when https://github.com/matrix-org/matrix-js-sdk/issues/4287 is solved. This helps because matrix-js-sdk switched to ESM and node can't handle that: https://vitest.dev/config/#server-deps-inline
		server: {
			deps: {
				inline: ['matrix-js-sdk'],
			},
		},
	},
	resolve: {
		alias,
	},
});
