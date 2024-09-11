/**
 * This store has some specific settings only needed for the hub-client
 */

import { defineStore } from 'pinia';
import { Message, MessageType, useMessageBox } from '@/store/store';

const useHubSettings = defineStore('hub-settings', {
	state: () => {
		return {
			// @ts-ignore
			parentUrl: _env.PARENT_URL,
			// @ts-ignore
			hubUrl: _env.HUB_URL,
			isSolo: window.self === window.top,
			mobileHubMenu: true,
		};
	},

	getters: {},
	actions: {
		// This is not really the right spot for these actions and "settings", but a shame to make a new store for just one thing. When adding more of these types of things extract them to another file.
		hideBar() {
			this.mobileHubMenu = false;
			const messagebox = useMessageBox();
			messagebox.sendMessage(new Message(MessageType.BarHide));
		},
	},
});

export { useHubSettings };
