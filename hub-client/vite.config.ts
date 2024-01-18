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
	},
	resolve: {
		alias,
	},
});
