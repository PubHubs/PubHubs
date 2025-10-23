/**
 * This is a store for handling message actions such as replying, forwarding, reacting etc.
 */
// Packages
import { defineStore } from 'pinia';

const useMessageActions = defineStore('message-actions', {
	state: () => {
		return {
			replyingTo: undefined as string | undefined,
			threadRoot: undefined as string | undefined,
		};
	},
});

export { useMessageActions };
