<template>
	<Menu>
		<template v-for="room in currentJoinedRooms" :key="room.roomId">
			<MenuItem :to="{ name: 'room', params: { id: room.roomId } }" :room="room" :icon="roomIcon(room)" @click="hubSettings.hideBar()" class="group inline-block w-full">
				<span class="flex w-full items-center justify-between gap-4">
					<TruncatedText>
						<PrivateRoomName v-if="room.isPrivateRoom()" :members="room.getOtherJoinedAndInvitedMembers()" />
						<GroupRoomName v-else-if="room.isGroupRoom()" :members="room.getOtherJoinedAndInvitedMembers()" />
						<AdminContactRoomName v-else-if="room.isAdminContactRoom()" :members="room.getOtherJoinedAndInvitedMembers()" />
						<RoomName v-else :room="room" />
					</TruncatedText>
					<span class="flex gap-2 transition-all duration-200 ease-in-out group-hover:hidden" v-if="settings.isFeatureEnabled(FeatureFlag.notifications)">
						<Badge class="~text-label-small-min/label-small-max" color="hub" v-if="room.getRoomUnreadNotificationCount(NotificationCountType.Total) > 99">99+</Badge>
						<Badge v-else-if="room.getRoomUnreadNotificationCount(NotificationCountType.Total) > 0" color="hub">{{ room.getRoomUnreadNotificationCount(NotificationCountType.Total) }}</Badge>
						<Badge color="hub" v-if="room.getRoomUnreadNotificationCount(NotificationCountType.Highlight) > 0"><Icon type="at" size="sm" class="shrink-0" /></Badge>
					</span>

					<Icon
						v-if="!room.isAdminContactRoom()"
						type="x"
						data-testid="leave-room"
						class="cursor-pointer stroke-2 text-on-surface-variant transition-all duration-200 ease-in-out hover:text-accent-error md:hidden md:group-hover:inline-block"
						@click.prevent="leaveRoom(room.roomId)"
					/>
				</span>
			</MenuItem>
		</template>
		<template v-if="props.roomType === RoomType.PH_MESSAGES_RESTRICTED" v-for="notification in notifications" :key="notification.room_id" class="relative flex flex-row">
			<MenuItem
				icon="shield"
				v-if="notification.room_id"
				@click="
					dialogOpen = notification.room_id;
					messageValues = notification.message_values;
				"
				class="group inline-block w-full text-on-surface-dim"
			>
				<span class="flex w-full items-center justify-between gap-4">
					<TruncatedText>
						<span>{{ notification.message_values[0] }}</span>
					</TruncatedText>
					<Icon
						type="unlink"
						class="relative cursor-pointer stroke-2 text-on-surface-variant transition-all duration-200 ease-in-out hover:text-accent-error md:hidden md:group-hover:inline-block"
						@click.prevent="dismissNotification(notification.room_id, $event)"
					/>
				</span>
			</MenuItem>
		</template>
	</Menu>
	<InlineSpinner v-if="!roomsLoaded" class="ml-4" />
	<SecuredRoomLoginDialog v-model:dialogOpen="dialogOpen" title="notifications.rejoin_secured_room" message="notifications.removed_from_secured_room" :messageValues="messageValues" />
</template>

<script setup lang="ts">
	// Components
	import InlineSpinner from '@/components/ui/InlineSpinner.vue';
	import Menu from '@/components/ui/Menu.vue';
	import MenuItem from '@/components/ui/MenuItem.vue';
	import TruncatedText from '@/components/elements/TruncatedText.vue';
	import PrivateRoomName from '@/components/rooms/PrivateRoomName.vue';
	import GroupRoomName from '@/components/rooms/GroupRoomName.vue';
	import AdminContactRoomName from '@/components/rooms/AdminContactRoomName.vue';
	import RoomName from '@/components/rooms/RoomName.vue';
	import Badge from '@/components/elements/Badge.vue';
	import Icon from '@/components/elements/Icon.vue';
	import SecuredRoomLoginDialog from '@/components/rooms/SecuredRoomLoginDialog.vue';

	// Logic
	import { usePubHubs } from '@/logic/core/pubhubsStore';
	import { PluginProperties, usePlugins } from '@/logic/store/plugins';
	import { FeatureFlag, useSettings } from '@/logic/store/settings';
	import { useDialog, useHubSettings, useRooms } from '@/logic/store/store';
	import { NotificationCountType } from 'matrix-js-sdk';
	import { Room, RoomType } from '@/logic/store/rooms';
	import { useNotifications } from '@/logic/store/notifications';

	// Third party
	import { useI18n } from 'vue-i18n';
	import { useRouter } from 'vue-router';
	import { computed, ref } from 'vue';

	// Model
	import { TNotification, TNotificationType } from '@/model/users/TNotification';

	const settings = useSettings();
	const hubSettings = useHubSettings();
	const notificationsStore = useNotifications();
	const { t } = useI18n();
	const router = useRouter();
	const rooms = useRooms();
	const pubhubs = usePubHubs();
	const plugins = usePlugins();
	const messageValues = ref<(string | number)[]>([]);
	const dialogOpen = ref<string | null>(null);
	const notifications = computed<TNotification[]>(() => notificationsStore.notifications.filter((notification: TNotification) => notification.type === TNotificationType.RemovedFromSecuredRoom));
	const dialog = useDialog();

	const props = defineProps({
		roomType: {
			type: String,
			default: undefined, // Don't define
		},
	});

	const currentJoinedRooms = computed(() => {
		return rooms.fetchRoomArrayByType(props.roomType).filter((room: Room) => room.isHidden() === false);
	});

	const roomsLoaded = computed(() => {
		return rooms.roomsLoaded;
	});

	async function leaveRoom(roomId: string) {
		const room = rooms.room(roomId);
		if (room) {
			const leaveMsg = await leaveMessageContext(roomId);
			if (room.isPrivateRoom() || room.isGroupRoom()) {
				if (await dialog.okcancel(t('rooms.hide_sure'))) {
					await pubhubs.setPrivateRoomHiddenStateForUser(room, true);
					await router.replace({ name: 'home' });
				}
			} else {
				// Message should changed based on who (admin) is leaving the room and under which condition.
				// e.g., Admin leaves the room and he is the only member or when admin leaves the room which makes the room without adminstrator.
				if (await dialog.okcancel(t(leaveMsg))) {
					await pubhubs.leaveRoom(roomId);
					notificationsStore.removeNotification(roomId, TNotificationType.RemovedFromSecuredRoom);
					await router.replace({ name: 'home' });
				}
			}
		}
	}

	// To display specific message based on the admin room status.
	async function leaveMessageContext(roomId: string): Promise<string> {
		const isSingleAdmin = await pubhubs.isSingleAdministration(roomId);
		return isSingleAdmin ? 'rooms.leave_admin' : 'rooms.leave_sure';
	}

	function roomIcon(room: Room): string {
		let icon = 'chats-circle';
		const plugin = plugins.hasRoomPlugin(room) as PluginProperties;
		if (plugin.icon) {
			icon = plugin.icon;
		}
		return icon;
	}
	async function dismissNotification(room_id: string, event: Event) {
		event.stopPropagation();
		if (await dialog.okcancel(t('rooms.leave_sure'))) {
			notificationsStore.removeNotification(room_id, TNotificationType.RemovedFromSecuredRoom);
		}
	}
</script>
