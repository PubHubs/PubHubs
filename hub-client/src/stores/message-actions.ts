/**
 * This is a store for handling message actions such as replying, forwarding, reacting etc.
 */
// Packages
import { defineStore } from 'pinia';

// Models
import { type FileInfo } from '@hub-client/models/events/FileInfo';

const useMessageActions = defineStore('message-actions', {
	state: () => {
		return {
			replyingTo: undefined as string | undefined,
			threadRoot: undefined as string | undefined,
			whisperingToUserId: undefined as string | undefined,
			whisperingToDisplayName: undefined as string | undefined,
			whisperingToEventId: undefined as string | undefined,
			// A library file waiting to be picked up by the message input. Cleared once attached.
			sharingFile: undefined as FileInfo | undefined,
		};
	},
});

export { useMessageActions };
