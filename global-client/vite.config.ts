/// <reference types="vitest" />
import tailwindcss from '@tailwindcss/vite';
import Vue from '@vitejs/plugin-vue';
import path from 'node:path';
import { URL, fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
	logLevel: 'warn',
	base: '/client/',
	root: './',
	server: {
		port: 8080,
		strictPort: true,
		fs: {
			allow: ['..'],
		},
	},
	plugins: [
		nodePolyfills(),
		tailwindcss(),
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
			workbox: {
				maximumFileSizeToCacheInBytes: 6 * 1024 * 1024, // 6MB
			},
		}),
		Vue(),
	],
	test: {
		root: './',
		globals: true,
		environment: 'jsdom',
		setupFiles: ['./test/setup-teardown-hooks.ts'],
		onConsoleLog(log) {
			if (log.includes('Expected Room, got Object')) return false;
			if (log.includes('Failed to resolve directive')) return false;
		},
	},
	resolve: {
		alias: {
			'@global-client': fileURLToPath(new URL('./src', import.meta.url)),
			'@hub-client': fileURLToPath(new URL('../hub-client/src', import.meta.url)),
			process: 'process/browser',
			vue: path.resolve(__dirname, 'node_modules/vue'),
			pinia: path.resolve(__dirname, 'node_modules/pinia'),
		},
		dedupe: ['pinia'], // Necessary to avoid duplicate pinia instances
	},
	build: {
		sourcemap: true,
		rollupOptions: {
			input: {
				// Define included files from outside global-client
				main: 'index.html',
				hubClient: '../hub-client/src/stores/messagebox.ts',
			},
			output: {
				entryFileNames: '[name].[hash].js',
			},
		},
	},
});
