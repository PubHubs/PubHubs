<template>
	<!-- Notification Bell Button -->
	<div v-if="notifications.length > 0" class="flex h-full flex-col items-end" :class="isMobile ? 'top-4' : 'top-10'">
		<button @click.stop="showNotifications = !showNotifications" class="bg-surface-low hover:bg-surface relative rounded-2xl p-2 shadow-sm">
			<Icon type="bell" size="md" />
			<span v-if="notifications.length > 0" class="bg-accent-red text-on-accent-red absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-xs">
				{{ notifications.length }}
			</span>
		</button>
		<!-- Notification Panel (directly under the bell) -->
		<div v-if="showNotifications" @click.stop class="border-surface-high bg-surface relative -right-2 z-50 mt-2 mb-8 max-h-96 overflow-y-auto rounded-lg border p-4 shadow-lg">
			<div class="mb-2 flex items-center justify-between">
				<span class="font-semibold">{{ t('notifications.heading') }}</span>
			</div>
			<div v-for="notification in notifications" :key="notification.type" class="bg-surface-low mt-2 flex flex-col items-end justify-between rounded-xs p-2 shadow-xs">
				<p class="mr-2">{{ t(`notifications.${notification.type}`, notification.message_values) }}</p>
				<div class="flex flex-row items-center gap-2">
					<Button v-if="(notification.type === TNotificationType.RemovedFromSecuredRoom || notification.type === TNotificationType.SoonRemovedFromSecuredRoom) && notification.room_id" @click="panelOpen = notification.room_id">{{
						t('notifications.rejoin')
					}}</Button>
					<button @click="dismissNotification(notification)" class="text-accent-red hover:underline">{{ t('notifications.dismiss') }}</button>
				</div>
				<RoomLoginDialog
					v-if="notification.room_id && panelOpen === notification.room_id"
					@click="panelOpen = null"
					v-model:dialogOpen="panelOpen"
					title="notifications.rejoin_secured_room"
					:message="t(`notifications.${notification.type}`, notification.message_values)"
					:messageValues="notification.message_values"
					:secured="true"
				/>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed, onMounted, onUnmounted, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import RoomLoginDialog from '@hub-client/components/ui/RoomLoginDialog.vue';

	// Models
	import { TNotification, TNotificationType } from '@hub-client/models/users/TNotification';

	// Stores
	import { useNotifications } from '@hub-client/stores/notifications';
	import { useSettings } from '@hub-client/stores/settings';

	const { t } = useI18n();
	const notificationsStore = useNotifications();
	const showNotifications = ref(false);
	const notifications = computed<TNotification[]>(() => notificationsStore.notifications);
	const panelOpen = ref<string | null>(null);
	const settings = useSettings();
	const isMobile = computed(() => settings.isMobileState);

	onMounted(async () => {
		document.addEventListener('click', handleGlobalClick);
		notificationsStore.fetchSecuredRoomNotifications();
	});

	onUnmounted(() => {
		document.removeEventListener('click', handleGlobalClick);
	});

	function handleGlobalClick() {
		showNotifications.value = false;
	}

	async function dismissNotification(notification: TNotification) {
		await notificationsStore.removeNotification(notification.room_id, notification.type);
	}
</script>
