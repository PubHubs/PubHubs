<template>
	<!-- data-initialized is used by e2e tests to detect when the initial sync is done -->
	<div
		class="flex justify-end"
		:data-initialized="initialized || undefined"
	>
		<Badge
			v-if="unreadState === 'unread'"
			color="ph"
			size="sm"
			data-testid="miniclient-badge"
		/>
		<Badge
			v-if="unreadState === 'unknown'"
			color="unknown"
			size="sm"
			data-testid="miniclient-unknown-badge"
		/>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { RoomEvent } from 'matrix-js-sdk';
	import { storeToRefs } from 'pinia';
	import { onMounted, onUnmounted, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Badge from '@hub-client/components/elements/Badge.vue';

	import { createLogger } from '@hub-client/logic/logging/Logger';

	// Models
	import type { UnreadState } from '@hub-client/models/rooms/TBaseRoom';
	import { loadUnreadInfoCache } from '@hub-client/models/rooms/unreadInfoCache';

	// Stores
	import { useHubSettings } from '@hub-client/stores/hub-settings';
	import { Message, MessageBoxType, MessageType, useMessageBox } from '@hub-client/stores/messagebox';
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useRooms } from '@hub-client/stores/rooms';
	import { useSettings } from '@hub-client/stores/settings';

	const logger = createLogger('Miniclient');
	const hubSettings = useHubSettings();
	const messagebox = useMessageBox();
	const rooms = useRooms();
	const pubhubs = usePubhubsStore();
	const settings = useSettings();
	const { locale, availableLocales } = useI18n();

	let unreadState = ref<UnreadState>('read');
	// Used by e2e tests (via data-initialized attribute) to detect when the initial sync is done.
	let initialized = ref(false);

	const { unreadCountVersion } = storeToRefs(rooms);

	function updateUnreadState(newState: UnreadState) {
		if (newState === 'unread' && unreadState.value !== 'unread') {
			messagebox.sendMessage(new Message(MessageType.UnreadMessages));
		}
		unreadState.value = newState;
	}

	/**
	 * Watch to detect changes in unread state that come from the sliding sync.
	 * When another user posts a new message into a room.
	 */
	watch(unreadCountVersion, async () => {
		updateUnreadState(await rooms.fetchAggregateUnreadState());
	});

	onMounted(async () => {
		logger.debug('Miniclient.vue onMounted');

		settings.initI18b({ locale: locale, availableLocales: availableLocales });

		// Fire-and-forget: hydrate the persisted unread cache from the global
		// client. Runs in parallel with login. When it resolves, refresh the
		// dots so any rooms whose previously-computed state is stale (or was
		// 'unknown' before the cache loaded) get updated.
		void loadUnreadInfoCache().then(() => rooms.refreshAllUnreadStates());

		// Startup, login, fetch the initial unread state, set watch for read receipt event
		startMessageBox()
			.then(() => pubhubs.login())
			.then(() => rooms.fetchAggregateUnreadState())
			.then((state) => {
				logger.debug('Miniclient.vue onMounted done');
				updateUnreadState(state);
				initialized.value = true;

				// Watch to detect if another user has send an read receipt
				pubhubs.client.on(RoomEvent.Receipt, receiptHandler);
			});
	});

	onUnmounted(() => {
		pubhubs.client.off(RoomEvent.Receipt, receiptHandler);
	});

	async function startMessageBox() {
		if (!hubSettings.isSolo) {
			messagebox.init(MessageBoxType.Child);
			await messagebox.startCommunication(hubSettings.parentUrl);
		}
	}

	async function receiptHandler() {
		updateUnreadState(await rooms.fetchAggregateUnreadState());
	}
</script>

<style>
	body {
		margin: 0;
	}
</style>
