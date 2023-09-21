/**
 * This is a store for handling message actions such as replying, forwarding, reacting etc.
 */

import { defineStore } from 'pinia';

const useMessageActions = defineStore('message-actions', {
	state: () => {
		return {
			//TODO: Add type for event
			replyingTo: undefined as Record<string, any> | undefined,
		};
	},
});

export { useMessageActions };
