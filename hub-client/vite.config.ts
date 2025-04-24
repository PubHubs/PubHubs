/// <reference types="vitest" />

import { defineConfig } from 'vite';
import { alias } from './alias';
import Vue from '@vitejs/plugin-vue';

export default defineConfig({
	plugins: [
		Vue({
			template: {
				compilerOptions: {
					isCustomElement: (tag) => ['Icon', 'ActionMenu', 'ActionMenuItem', 'AvatarMember', 'Avatar', 'ProgressBar', 'ProgressBarMulti', 'H2', 'Line', 'Button'].includes(tag),
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
