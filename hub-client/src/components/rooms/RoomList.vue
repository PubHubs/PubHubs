<template>
	<Menu>
		<InlineSpinner v-if="!rooms.roomsLoaded"></InlineSpinner>
		<!-- There is always the general room -->
		<template v-for="room in rooms.sortedRoomsArray" :key="room.roomId">
			<div v-if="showRoom(room)" :key="room.roomId" class="group" @click="toggleMenu.toggleGlobalMenu()">
				<MenuItem :to="{ name: 'room', params: { id: room.roomId } }" :roomInfo="room" :icon="roomIcon(room)" :key="room.roomId">
					<div class="flex justify-between gap-4 w-full">
						<TruncatedText>
							<PrivateRoomName v-if="room.isPrivateRoom()" :members="room.getOtherJoinedAndInvitedMembers()"></PrivateRoomName>
							<RoomName v-else :room="room"></RoomName>
						</TruncatedText>
						<div class="flex gap-2">
							<div class="flex gap-2 group-hover:opacity-0 opacity-100 transition-all duration-200 ease-in-out" v-if="settings.isFeatureEnabled(featureFlagType.notifications)">
								<UnreadMessageBadge v-if="room.getRoomUnreadNotificationCount(NotificationCountType.Total) > 0">{{ room.getRoomUnreadNotificationCount(NotificationCountType.Total) }}</UnreadMessageBadge>
								<UnreadMentionBadge v-if="room.getRoomUnreadNotificationCount(NotificationCountType.Highlight) > 0">{{ room.getRoomUnreadNotificationCount(NotificationCountType.Highlight) }}</UnreadMentionBadge>
							</div>
							<Icon type="unlink" class="cursor-pointer hover:text-red group-hover:opacity-100 opacity-0 transition-all duration-200 ease-in-out" @click.prevent="leaveRoom(room.roomId)"></Icon>
						</div>
					</div>
				</MenuItem>
			</div>
		</template>
	</Menu>
</template>

<script setup lang="ts">
	import { useI18n } from 'vue-i18n';
	import { useRouter } from 'vue-router';
	import { Room, useRooms, useDialog, RoomType, useUser } from '@/store/store';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { usePlugins, PluginProperties } from '@/store/plugins';
	import { useToggleMenu } from '@/store/toggleGlobalMenu';
	import { NotificationCountType } from 'matrix-js-sdk';
	import { useSettings, featureFlagType } from '@/store/store';
	import { isVisiblePrivateRoom } from '@/core/privateRoomNames';

	const settings = useSettings();

	const { t } = useI18n();
	const router = useRouter();
	const rooms = useRooms();
	const pubhubs = usePubHubs();
	const plugins = usePlugins();
	const toggleMenu = useToggleMenu();

	const props = defineProps({
		roomType: {
			type: String,
			default: '!' + RoomType.PH_MESSAGES_DM,
		},
	});

	// Either private room or public room based on roomType given as prop (private or normal)
	// Needs a bit of refacturing, not so clear now.
	function showRoom(room: Room): Boolean {
		// if no specific type is set, allways show this room
		if (props.roomType !== '') {
			const type = props.roomType.substring(1);
			// If not (given room type), just show
			if (props.roomType.charAt(0) === '!') {
				return room.getType() !== type;
			} else {
				const roomType = room.getType();
				if (roomType === RoomType.PH_MESSAGES_DM) {
					// Check if private room is visible for this user BUSY
					const user = useUser();
					return isVisiblePrivateRoom(room.name, user.user);
				} else {
					return room.getType() === props.roomType;
				}
			}
		}
		return true;
	}

	async function leaveRoom(roomId: string) {
		const room = rooms.room(roomId);
		if (room) {
			const dialog = useDialog();
			if (room.isPrivateRoom()) {
				if (await dialog.okcancel(t('rooms.hide_sure'))) {
					await pubhubs.setPrivateRoomHiddenStateForUser(room, true);
					await router.replace({ name: 'home' });
				}
			} else {
				if (await dialog.okcancel(t('rooms.leave_sure'))) {
					await pubhubs.leaveRoom(roomId);
					await router.replace({ name: 'home' });
				}
			}
		}
	}

	function roomIcon(room: Room): string {
		let icon = 'room';
		const plugin = plugins.hasRoomPlugin(room) as PluginProperties;
		if (plugin.icon) {
			icon = plugin.icon;
		}
		return icon;
	}
</script>
