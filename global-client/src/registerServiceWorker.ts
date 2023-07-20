/* eslint-disable no-console */

import { register } from 'register-service-worker';

if (process.env.NODE_ENV === 'production') {
	register(`${process.env.BASE_URL}service-worker.js`, {
		ready() {
			console.log('Service worker: ready');
		},
		registered() {
			console.log('Service worker: has been registered.');
		},
		cached() {
			console.log('Service worker: Content has been cached for offline use.');
		},
		updatefound() {
			console.log('Service worker: New content is downloading.');
		},
		updated() {
			console.log('Service worker: New content is available; please refresh.');
		},
		offline() {
			console.log('Service worker: No internet connection found. App is running in offline mode.');
		},
		error(error) {
			console.error('Service worker: Error during service worker registration:', error);
		},
	});
}
