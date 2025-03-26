<template>
	<Badge class="~text-label-min/label-max" color="ph" v-if="unreadMessages > 99">99+</Badge>
	<Badge class="~text-label-min/label-max" color="ph" v-else-if="unreadMessages > 0">{{ unreadMessages }}</Badge>
</template>

<script setup lang="ts">
	// Components
	import Badge from '@/components/elements/Badge.vue';

	import { usePubHubs } from '@/logic/core/pubhubsStore';
	import { useHubSettings } from '@/logic/store/hub-settings';
	import { useMessageBox, MessageBoxType } from '@/logic/store/messagebox';
	import { useRooms } from '@/logic/store/rooms';
	import { useSettings } from '@/logic/store/settings';
	import { LOGGER } from '@/logic/foundation/Logger';
	import { SMI } from '@/logic/foundation/StatusMessage';
	import { onMounted, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	const hubSettings = useHubSettings();
	const messagebox = useMessageBox();
	const pubhubs = usePubHubs();
	const rooms = useRooms();
	const settings = useSettings();

	const { locale, availableLocales } = useI18n();

	let unreadMessages = ref<number>(0);

	watch(
		() => rooms.totalUnreadMessages,
		(value: number, oldValue: number) => {
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
