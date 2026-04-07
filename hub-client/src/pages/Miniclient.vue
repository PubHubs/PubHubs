<template>
	<!-- data-initialized is used by e2e tests to detect when the initial sync is done -->
	<div
		class="flex justify-end"
		:data-initialized="initialized || undefined"
	>
		<Badge
			v-if="unreadMessages > 0"
			color="ph"
			:size="badgeSize(unreadMessages)"
			data-testid="miniclient-badge"
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
	// Logic
	import { badgeSize } from '@hub-client/logic/utils/badgeUtils';

	// Stores
	import { useHubSettings } from '@hub-client/stores/hub-settings';
	import { MessageBoxType, useMessageBox } from '@hub-client/stores/messagebox';
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

	let unreadMessages = ref<number>(0);
	// Used by e2e tests (via data-initialized attribute) to detect when the initial sync is done.
	let initialized = ref(false);

	const { unreadCountVersion } = storeToRefs(rooms);

	/**
	 * Watch to detect changes in unread count that come from the sliding sync.
	 * When another user posts a new message into a room.
	 */
	watch(unreadCountVersion, async () => {
		unreadMessages.value = await rooms.fetchTotalUnreadCounts();
	});

	onMounted(async () => {
		logger.debug('Miniclient.vue onMounted');

		settings.initI18b({ locale: locale, availableLocales: availableLocales });

		// Startup, login, fetch the initial unread count, set watch for read receipt event
		startMessageBox()
			.then(() => pubhubs.login())
			.then(() => rooms.fetchTotalUnreadCounts())
			.then((numberUnread) => {
				logger.debug('Miniclient.vue onMounted done');
				unreadMessages.value = numberUnread;
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
		unreadMessages.value = await rooms.fetchTotalUnreadCounts();
	}
</script>

<style>
	body {
		margin: 0;
	}
</style>
