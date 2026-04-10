<template>
	<MiniclientBadge
		:unread-state="unreadState"
		:initialized="initialized"
	/>
</template>

<script setup lang="ts">
	/**
	 * Independent miniclient: runs its own MatrixClient + sliding sync and
	 * computes the aggregate unread state locally via useUnreadAggregate.
	 * Used when this hub is NOT the currently active hub in the global
	 * client — or in solo mode, where the miniclient runs standalone (e.g.
	 * the 26-miniclient-badge e2e test).
	 *
	 * The sibling MiniclientLinked.vue is used when this hub IS the globally
	 * active one — in that case the active hub client pushes the unread
	 * state via messagebox and no second sync is needed.
	 *
	 * onUnmounted stops the sliding sync so the outer Miniclient.vue can
	 * switch to MiniclientLinked without leaving a background sync alive.
	 */
	// Packages
	import { onMounted, onUnmounted, ref, watch } from 'vue';

	// Components
	import MiniclientBadge from '@hub-client/components/ui/MiniclientBadge.vue';

	// Composables
	import { useMatrix } from '@hub-client/composables/matrix.composable';
	import { useUnreadAggregate } from '@hub-client/composables/unreadAggregate.composable';

	// Logic
	import { createLogger } from '@hub-client/logic/logging/Logger';

	// Stores
	import { Message, MessageType, useMessageBox } from '@hub-client/stores/messagebox';
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';

	const logger = createLogger('MiniclientIndependent');
	const messagebox = useMessageBox();
	const pubhubs = usePubhubsStore();

	const { unreadState, setupUnreadAggregateTracking } = useUnreadAggregate();
	const initialized = ref(false);

	// Fire UnreadMessages on the read → unread transition so the parent shows
	// a desktop notification for this hub.
	watch(unreadState, (state, previous) => {
		if (state === 'unread' && previous !== 'unread') {
			messagebox.sendMessage(new Message(MessageType.UnreadMessages));
		}
	});

	onMounted(async () => {
		logger.debug('MiniclientIndependent onMounted');
		await pubhubs.login();
		await setupUnreadAggregateTracking();
		initialized.value = true;
		logger.debug('MiniclientIndependent onMounted done');
	});

	onUnmounted(() => {
		logger.debug('MiniclientIndependent onUnmounted — stopping sync');
		useMatrix().stopSync();
	});
</script>
