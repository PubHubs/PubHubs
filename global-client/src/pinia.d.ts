// Packages
import 'pinia';
import type { Router } from 'vue-router';

// The router is handed to every store by the plugin in main.ts.
declare module 'pinia' {
	export interface PiniaCustomProperties {
		router: Router;
	}
}
