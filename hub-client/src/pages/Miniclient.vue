<template>
	<Badge class="text-label" color="ph" v-if="unreadMessages > 99">99+</Badge>
	<Badge class="text-label" color="ph" v-else-if="unreadMessages > 0">{{ unreadMessages }}</Badge>
</template>

<script setup lang="ts">
	// Packages
	import { onMounted, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Badge from '@hub-client/components/elements/Badge.vue';

	// Logic
	import { LOGGER } from '@hub-client/logic/logging/Logger';
	import { SMI } from '@hub-client/logic/logging/StatusMessage';

	// Stores
	import { useHubSettings } from '@hub-client/stores/hub-settings';
	import { MessageBoxType, useMessageBox } from '@hub-client/stores/messagebox';
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useRooms } from '@hub-client/stores/rooms';
	import { useSettings } from '@hub-client/stores/settings';

	const hubSettings = useHubSettings();
	const messagebox = useMessageBox();
	const pubhubs = usePubhubsStore();
	const rooms = useRooms();
	const settings = useSettings();
	const { locale, availableLocales } = useI18n();

	let unreadMessages = ref<number>(0);

	watch(
		() => rooms.totalUnreadMessages,
		(value: number, oldValue: number) => {
			console.warn('[Miniclient] totalUnreadMessages changed:', { oldValue, value });
			unreadMessages.value = rooms.totalUnreadMessages;
			// A notification should only be sent when the unread message counter increases, not when it decreases due to reading messages.
			if (oldValue < value) {
				rooms.sendUnreadMessageCounter();
			}
		},
	);

	onMounted(async () => {
		LOGGER.trace(SMI.STARTUP, 'Miniclient.vue onMounted');

		settings.initI18b({ locale: locale, availableLocales: availableLocales });

		await startMessageBox();

		LOGGER.trace(SMI.STARTUP, 'Miniclient.vue onMounted done');
	});

	async function startMessageBox() {
		if (!hubSettings.isSolo) {
			messagebox.init(MessageBoxType.Child);
			await messagebox.startCommunication(hubSettings.parentUrl);
		}
	}

	pubhubs.login();
</script>
