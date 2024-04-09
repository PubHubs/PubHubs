/**
 * This is a store for handling message actions such as replying, forwarding, reacting etc.
 */

import { TMessageEvent } from '@/model/events/TMessageEvent';
import { defineStore } from 'pinia';

const useMessageActions = defineStore('message-actions', {
	state: () => {
		return {
			replyingTo: undefined as TMessageEvent | undefined,
		};
	},
});

export { useMessageActions };
