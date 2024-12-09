<template>
	<InlineSpinner v-if="!rooms.roomsLoaded" class="ml-4"></InlineSpinner>
	<Menu v-else>
		<template v-for="room in rooms.sortedRoomsArray" :key="room.roomId">
			<template v-if="showRoom(room)">
				<MenuItem :to="{ name: 'room', params: { id: room.roomId } }" :roomInfo="room" :icon="roomIcon(room)" :key="room.roomId" @click="hubSettings.hideBar()" class="group inline-block w-full">
					<span class="flex gap-2 w-full justify-between items-center">
						<TruncatedText>
							<PrivateRoomName v-if="room.isPrivateRoom()" :members="room.getOtherJoinedAndInvitedMembers()"></PrivateRoomName>
							<RoomName v-else :room="room"></RoomName>
						</TruncatedText>
						<span class="flex gap-2 group-hover:hidden transition-all duration-200 ease-in-out" v-if="settings.isFeatureEnabled(FeatureFlag.notifications)">
							<Badge class="text-xxs" color="hub" v-if="room.getRoomUnreadNotificationCount(NotificationCountType.Total) > 99">99+</Badge>
							<Badge v-else-if="room.getRoomUnreadNotificationCount(NotificationCountType.Total) > 0" color="hub">{{ room.getRoomUnreadNotificationCount(NotificationCountType.Total) }}</Badge>

							<Badge color="hub" v-if="room.getRoomUnreadNotificationCount(NotificationCountType.Highlight) > 0"><Icon type="mention" size="sm" class="shrink-0"></Icon></Badge>
						</span>
						<Icon type="unlink" class="cursor-pointer hover:text-red-light stroke-2 group-hover:inline-block hidden transition-all duration-200 ease-in-out" @click.prevent="leaveRoom(room.roomId)"></Icon>
					</span>
				</MenuItem>
			</template>
		</template>
	</Menu>
</template>

<script setup lang="ts">
	import { isVisiblePrivateRoom } from '@/core/privateRoomNames';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { PluginProperties, usePlugins } from '@/store/plugins';
	import { RoomType } from '@/store/rooms';
	import { FeatureFlag, useSettings } from '@/store/settings';
	import { useDialog, useHubSettings, useRooms } from '@/store/store';
	import { useUser } from '@/store/user';
	import { NotificationCountType, Room } from 'matrix-js-sdk';
	import { useI18n } from 'vue-i18n';
	import { useRouter } from 'vue-router';

	const settings = useSettings();
	const hubSettings = useHubSettings();

	const { t } = useI18n();
	const router = useRouter();
	const rooms = useRooms();
	const pubhubs = usePubHubs();
	const plugins = usePlugins();

	const props = defineProps({
		roomType: {
			type: String,
			default: '!' + RoomType.PH_MESSAGES_DM,
		},
	});

	// Either private room or public room based on roomType given as prop (private or normal)
	// Needs a bit of refacturing, not so clear now.
	function showRoom(room: Room): Boolean {
		const roomType = room.getType();

		// if no specific type is set, allways show this room
		if (props.roomType !== '') {
			const type = props.roomType.substring(1);
			// If not (given room type), just show
			if (props.roomType.charAt(0) === '!') {
				return roomType !== type;
			} else {
				if (roomType === RoomType.PH_MESSAGES_DM) {
					// Check if private room is visible for this user BUSY
					const user = useUser();
					return isVisiblePrivateRoom(room.name, user.user);
				} else {
					return roomType === props.roomType;
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
		let icon = 'speech_bubbles';
		const plugin = plugins.hasRoomPlugin(room) as PluginProperties;
		if (plugin.icon) {
			icon = plugin.icon;
		}
		return icon;
	}
</script>
