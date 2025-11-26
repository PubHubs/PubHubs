<template>
	<Menu>
		<template v-for="room in currentJoinedRooms" :key="room.roomId">
			<MenuItem :to="{ name: 'room', params: { id: room.roomId } }" :room="room" icon="chats-circle" @click="hubSettings.hideBar()" class="group inline-block w-full">
				<span class="flex w-full items-center justify-between gap-4">
					<TruncatedText>
						<PrivateRoomName v-if="room.isPrivateRoom()" :members="room.getOtherJoinedAndInvitedMembers()" />
						<GroupRoomName v-else-if="room.isGroupRoom()" :members="room.getOtherJoinedAndInvitedMembers()" />
						<AdminContactRoomName v-else-if="room.isAdminContactRoom()" :members="room.getOtherJoinedAndInvitedMembers()" />
						<RoomName v-else :room="room" />
					</TruncatedText>
					<span class="flex gap-2 transition-all duration-200 ease-in-out group-hover:hidden" v-if="settings.isFeatureEnabled(FeatureFlag.notifications)">
						<Badge class="text-label-small" color="hub" v-if="room.getRoomUnreadNotificationCount(NotificationCountType.Total) > 99">99+</Badge>
						<Badge v-else-if="room.getRoomUnreadNotificationCount(NotificationCountType.Total) > 0" color="hub">{{ room.getRoomUnreadNotificationCount(NotificationCountType.Total) }}</Badge>
						<Badge color="hub" v-if="room.getRoomUnreadNotificationCount(NotificationCountType.Highlight) > 0"><Icon type="at" size="sm" class="shrink-0" /></Badge>
					</span>

					<Icon
						v-if="!room.isAdminContactRoom()"
						type="x"
						data-testid="leave-room"
						class="text-on-surface-variant hover:text-accent-error cursor-pointer stroke-2 transition-all duration-200 ease-in-out md:hidden md:group-hover:inline-block"
						@click.prevent="leaveRoom(room.roomId)"
					/>
				</span>
			</MenuItem>
		</template>
		<template v-if="props.roomTypes.length === 1 && props.roomTypes[0] === RoomType.PH_MESSAGES_RESTRICTED" v-for="notification in notifications" :key="notification.room_id" class="relative flex flex-row">
			<MenuItem
				icon="shield"
				v-if="notification.room_id"
				@click="
					dialogOpen = notification.room_id;
					messageValues = notification.message_values;
				"
				class="group text-on-surface-dim inline-block w-full"
			>
				<span class="flex w-full items-center justify-between gap-4">
					<TruncatedText>
						<span>{{ notification.message_values[0] }}</span>
					</TruncatedText>
					<Icon
						type="unlink"
						class="text-on-surface-variant hover:text-accent-error relative cursor-pointer stroke-2 transition-all duration-200 ease-in-out md:hidden md:group-hover:inline-block"
						@click.prevent="dismissNotification(notification.room_id, $event)"
					/>
				</span>
			</MenuItem>
		</template>
	</Menu>
	<div class="ml-4">
		<InlineSpinner v-if="!roomsLoaded" />
	</div>
	<SecuredRoomLoginDialog v-model:dialogOpen="dialogOpen" title="notifications.rejoin_secured_room" message="notifications.removed_from_secured_room" :messageValues="messageValues" />
</template>

<script setup lang="ts">
	// Packages
	import { NotificationCountType } from 'matrix-js-sdk';
	import { PropType, computed, ref } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { useRouter } from 'vue-router';

	// Components
	import Badge from '@hub-client/components/elements/Badge.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import TruncatedText from '@hub-client/components/elements/TruncatedText.vue';
	import AdminContactRoomName from '@hub-client/components/rooms/AdminContactRoomName.vue';
	import GroupRoomName from '@hub-client/components/rooms/GroupRoomName.vue';
	import PrivateRoomName from '@hub-client/components/rooms/PrivateRoomName.vue';
	import RoomName from '@hub-client/components/rooms/RoomName.vue';
	import SecuredRoomLoginDialog from '@hub-client/components/rooms/SecuredRoomLoginDialog.vue';
	import InlineSpinner from '@hub-client/components/ui/InlineSpinner.vue';
	import Menu from '@hub-client/components/ui/Menu.vue';
	import MenuItem from '@hub-client/components/ui/MenuItem.vue';

	// Models
	import Room from '@hub-client/models/rooms/Room';
	import { RoomType } from '@hub-client/models/rooms/TBaseRoom';
	import { TNotificationType } from '@hub-client/models/users/TNotification';

	// Stores
	import { useDialog } from '@hub-client/stores/dialog';
	import { useHubSettings } from '@hub-client/stores/hub-settings';
	import { useNotifications } from '@hub-client/stores/notifications';
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useRooms } from '@hub-client/stores/rooms';
	import { FeatureFlag, useSettings } from '@hub-client/stores/settings';

	const settings = useSettings();
	const hubSettings = useHubSettings();
	const notifications = useNotifications();
	const { t } = useI18n();
	const router = useRouter();
	const rooms = useRooms();
	const pubhubs = usePubhubsStore();
	const messageValues = ref<(string | number)[]>([]);
	const dialogOpen = ref<string | null>(null);
	const dialog = useDialog();

	const props = defineProps({
		roomTypes: {
			type: Array as PropType<RoomType[]>,
			required: true,
			default: () => [RoomType.PH_MESSAGES_DEFAULT], // To make sure vue recognizes it, this needs a real array as default
		},
	});

	const currentJoinedRooms = computed(() => {
		return rooms.fetchRoomArrayByAccessibility(props.roomTypes).filter((room: Room) => room.isHidden() === false);
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
					if (rooms.roomIsSecure(roomId)) {
						notificationsStore.removeNotification(roomId, TNotificationType.RemovedFromSecuredRoom);
					}
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

	async function dismissNotification(room_id: string, event: Event) {
		event.stopPropagation();
		if (await dialog.okcancel(t('rooms.leave_sure'))) {
			notificationsStore.removeNotification(room_id, TNotificationType.RemovedFromSecuredRoom);
		}
	}
</script>
