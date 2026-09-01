import tailwindcss from '@tailwindcss/vite';
import Vue from '@vitejs/plugin-vue';
import { execSync } from 'node:child_process';
import { URL, fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { VitePWA } from 'vite-plugin-pwa';
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

// Puts the version in a plain file next to the bundle, so the deployed version can be read without
// digging through the minified bundle for the string literal `define` put there.
const emitVersionFile: Plugin = {
	name: 'ph-emit-version',
	generateBundle() {
		this.emitFile({ type: 'asset', fileName: 'version.txt', source: `${version}\n` });
	},
};

export default defineConfig({
	logLevel: 'warn',
	base: '/client/',
	define: {
		__APP_VERSION__: JSON.stringify(version),
	},
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
			selfDestroying: true,
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
		emitVersionFile,
	],
	test: {
		root: './',
		globals: true,
		environment: 'jsdom',
		environmentOptions: {
			jsdom: { url: 'https://test.example' },
		},
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
			'@global-client': fileURLToPath(new URL('./src', import.meta.url)),
			'@hub-client': fileURLToPath(new URL('../hub-client/src', import.meta.url)),
			'vue-i18n': 'vue-i18n/dist/vue-i18n.esm-bundler.js',
		},
		dedupe: ['pinia'], // Necessary to avoid duplicate pinia instances
	},
	build: {
		sourcemap: true,
		rollupOptions: {
			// dialog.ts imports i18n dynamically so the hub client's miniclient can leave the locale
			// catalogues out of its startup graph. The global client mounts i18n from main.ts, so here the
			// module is statically reachable anyway and the split cannot happen — expected, not a problem
			// to fix on this side.
			onwarn(warning, defaultHandler) {
				if (warning.code === 'INEFFECTIVE_DYNAMIC_IMPORT') return;
				defaultHandler(warning);
			},
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
