<template>
	<Menu>
		<InlineSpinner v-if="!rooms.roomsLoaded"></InlineSpinner>
		<!-- There is always the general room -->
		<template v-if="rooms.hasRooms">
			<template v-for="room in rooms.sortedRoomsArray" :key="room.roomId">
				<div v-if="showRoom(room)" :key="room.roomId" class="group" @click="toggleMenu.toggleGlobalMenu()">
					<router-link :to="{ name: 'room', params: { id: room.roomId } }" v-slot="{ isActive }">
						<MenuItem :roomInfo="room" :icon="roomIcon(room)" :active="isActive" :key="room.roomId">
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
					</router-link>
				</div>
			</template>
		</template>
	</Menu>
</template>

<script setup lang="ts">
	import { useI18n } from 'vue-i18n';
	import { useRouter } from 'vue-router';
	import { Room, useRooms, useDialog } from '@/store/store';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { RoomType } from '@/store/rooms';
	import { usePlugins, PluginProperties } from '@/store/plugins';
	import { useToggleMenu } from '@/store/toggleGlobalMenu';
	import { NotificationCountType } from 'matrix-js-sdk';
	import { useSettings, featureFlagType } from '@/store/store';
	import TruncatedText from '../elements/TruncatedText.vue';
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

	// Either private room or public room based on roomType
	function showRoom(room: Room): Boolean {
		if (props.roomType !== '') {
			const type = props.roomType.substring(1);
			if (props.roomType.charAt(0) === '!') {
				return room.getType() !== type;
			} else {
				return room.getType() === props.roomType;
			}
		}
		return true;
	}

	async function leaveRoom(roomId: string) {
		const room = rooms.room(roomId);
		if (room) {
			const dialog = useDialog();
			if (await dialog.okcancel(t('rooms.leave_sure'))) {
				await pubhubs.leaveRoom(roomId);
				await router.replace({ name: 'home' });
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
