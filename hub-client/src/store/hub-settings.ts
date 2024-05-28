/**
 * This store has some specific settings only needed for the hub-client
 */

import { defineStore } from 'pinia';

const useHubSettings = defineStore('hub-settings', {
	state: () => {
		return {
			// @ts-ignore
			parentUrl: _env.PARENT_URL,
			// @ts-ignore
			hubUrl: _env.HUB_URL,
			isSolo: window.self === window.top,
			mobileHubMenu: false,
		};
	},

	getters: {},
});

export { useHubSettings };
