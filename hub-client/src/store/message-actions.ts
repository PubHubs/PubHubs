/**
 * This is a store for handling message actions such as replying, forwarding, reacting etc.
 */

import { M_MessageEvent } from '@/types/events';
import { defineStore } from 'pinia';

const useMessageActions = defineStore('message-actions', {
	state: () => {
		return {
			replyingTo: undefined as M_MessageEvent | undefined,
		};
	},
});

export { useMessageActions };
