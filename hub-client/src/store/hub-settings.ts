/**
 * This store has some specific settings only needed for the hub-client
 */

import { defineStore } from 'pinia';

const useHubSettings = defineStore('hub-settings', {
	state: () => {
		return {
			// @ts-ignore
			parentUrl: _env.PARENT_URL,
			isSolo: window.self === window.top,
			visibleEventTypes: ['m.room.message'],
			mobileHubMenu: false,
		};
	},

	getters: {
		getVisibleEventTypes: (state) => state.visibleEventTypes,

		isVisibleEventType: (state) => (type: string) => {
			return state.visibleEventTypes.includes(type);
		},
	},

	actions: {
		skipNoticeUserEvent(event: Record<string, any>): boolean {
			return String(event.sender).includes('@notices') ? false : true;
		},
	},
});

export { useHubSettings };
