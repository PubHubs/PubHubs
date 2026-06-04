<template>
	<MiniclientBadge :unread-state="unreadState" />
</template>

<script setup lang="ts">
	/**
	 * Linked miniclient: runs NO MatrixClient of its own. Used when this hub
	 * is the currently-active hub in the global client — the active hub
	 * client already has a sync going, and pushes its aggregate unread state
	 * via messagebox so we can mirror it here.
	 *
	 * The sibling MiniclientIndependent.vue is used when this hub is not the
	 * globally active one (and in solo mode).
	 *
	 * Notifications for the read → unread transition are fired by the active
	 * hub client itself — firing them here too would double up.
	 *
	 * Race handling: the parent buffers the last AggregateUnreadState per hub
	 * and replays it after sending HubActive(true), so by the time Linked has
	 * mounted and registered its callback (via Vue's microtask-flush between
	 * the two incoming postMessage tasks), the replayed state is still
	 * in-flight and arrives as the next message event.
	 */
	// Packages
	import { onUnmounted, ref } from 'vue';

	// Components
	import MiniclientBadge from '@hub-client/components/ui/MiniclientBadge.vue';

	// Models
	import type { UnreadState } from '@hub-client/models/rooms/TBaseRoom';

	// Stores
	import { type Message, MessageType, useMessageBox } from '@hub-client/stores/messagebox';

	const messagebox = useMessageBox();
	const unreadState = ref<UnreadState>('unknown');

	messagebox.addCallback('parentFrame', MessageType.AggregateUnreadState, (message: Message) => {
		const content = message.content as { state?: UnreadState };
		if (content.state === undefined) return;
		unreadState.value = content.state;
	});

	onUnmounted(() => {
		messagebox.removeCallback('parentFrame', MessageType.AggregateUnreadState);
	});
</script>
