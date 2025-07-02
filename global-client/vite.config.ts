/// <reference types="vitest" />

import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { VitePWA } from 'vite-plugin-pwa';
import Vue from '@vitejs/plugin-vue';
import path from 'node:path';

export default defineConfig({
	logLevel: 'warn',
	base: '/client/',
	root: './',
	server: {
		port: 8082,
		strictPort: true,
		// TODO see if we get hmr working
		// hmr: {
		// 	protocol: 'ws',
		// 	host: 'localhost',
		// 	port: 8082,
		// 	path: '/client',
		// },
	},
	plugins: [
		Vue(),
		nodePolyfills(),
		VitePWA({
			registerType: 'autoUpdate',
			manifest: {
				name: 'PubHubs',
				short_name: 'PubHubs',
				id: '/PubHubs/v1',
				theme_color: '#000000',
				background_color: '#ffffff',
				icons: [
					{
						src: 'img/icons/android-chrome-512x512.png',
						type: 'image/png',
						sizes: '512x512',
					},
					{
						src: 'img/icons/android-chrome-192x192.png',
						type: 'image/png',
						sizes: '192x192',
					},
					{
						src: 'img/icons/android-chrome-maskable-512x512.png',
						type: 'image/png',
						sizes: '512x512',
						purpose: 'maskable',
					},
					{
						src: 'img/icons/android-chrome-maskable-192x192.png',
						type: 'image/png',
						sizes: '192x192',
						purpose: 'maskable',
					},
					{
						src: 'img/icons/apple-touch-icon-60x60.png',
						type: 'image/png',
						sizes: '60x60',
					},
					{
						src: 'img/icons/apple-touch-icon-76x76.png',
						type: 'image/png',
						sizes: '76x76',
					},
					{
						src: 'img/icons/apple-touch-icon-120x120.png',
						type: 'image/png',
						sizes: '120x120',
					},
					{
						src: 'img/icons/apple-touch-icon-152x152.png',
						type: 'image/png',
						sizes: '152x152',
					},
					{
						src: 'img/icons/apple-touch-icon-180x180.png',
						type: 'image/png',
						sizes: '180x180',
					},
				],
				start_url: '/',
				scope: '/',
				display: 'standalone',
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
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url)),
			process: 'process/browser',
			vue: path.resolve(__dirname, 'node_modules/vue'),
			pinia: path.resolve(__dirname, 'node_modules/pinia'),
		},
		dedupe: ['pinia'], // necessary to avoid duplicate pinia instances
	},
	build: {
		sourcemap: true,
		outDir: '../pubhubs/static/assets/client',
		emptyOutDir: true,
		rollupOptions: {
			input: {
				// define included files from outside global-client
				main: 'index.html',
				hubClient: '../hub-client/src/logic/store/messagebox.ts',
			},
			output: {
				entryFileNames: '[name].[hash].js',
			},
		},
	},
});
