<template>
	<Menu>
		<template v-for="room in rooms.sortedRoomsArray" :key="room.roomId">
			<template v-if="showRoom(room)">
				<MenuItem :to="{ name: 'room', params: { id: room.roomId } }" :roomInfo="room" :icon="roomIcon(room)" :key="room.roomId" @click="hubSettings.hideBar()" class="group inline-block w-full">
					<span class="flex w-full items-center justify-between gap-4">
						<TruncatedText>
							<PrivateRoomName v-if="room.isPrivateRoom()" :members="room.getOtherJoinedAndInvitedMembers()" />
							<RoomName v-else :room="room" />
						</TruncatedText>
						<span class="flex gap-2 transition-all duration-200 ease-in-out group-hover:hidden" v-if="settings.isFeatureEnabled(FeatureFlag.notifications)">
							<Badge class="~text-label-small-min/label-small-max" color="hub" v-if="room.getRoomUnreadNotificationCount(NotificationCountType.Total) > 99">99+</Badge>
							<Badge v-else-if="room.getRoomUnreadNotificationCount(NotificationCountType.Total) > 0" color="hub">{{ room.getRoomUnreadNotificationCount(NotificationCountType.Total) }}</Badge>
							<Badge color="hub" v-if="room.getRoomUnreadNotificationCount(NotificationCountType.Highlight) > 0"><Icon type="mention" size="sm" class="shrink-0" /></Badge>
						</span>

						<Icon
							type="unlink"
							class="cursor-pointer stroke-2 text-on-surface-variant transition-all duration-200 ease-in-out hover:text-accent-error md:hidden md:group-hover:inline-block"
							@click.prevent="leaveRoom(room.roomId)"
						/>
					</span>
				</MenuItem>
			</template>
		</template>
	</Menu>
	<InlineSpinner v-if="!roomsLoaded" class="ml-4" />
</template>

<script setup lang="ts">
	// Components
	import InlineSpinner from '../ui/InlineSpinner.vue';
	import Menu from '../ui/Menu.vue';
	import MenuItem from '../ui/MenuItem.vue';
	import TruncatedText from '../elements/TruncatedText.vue';
	import PrivateRoomName from './PrivateRoomName.vue';
	import RoomName from './RoomName.vue';
	import Badge from '../elements/Badge.vue';
	import Icon from '../elements/Icon.vue';

	import { isVisiblePrivateRoom } from '@/logic/core/privateRoomNames';
	import { usePubHubs } from '@/logic/core/pubhubsStore';
	import { PluginProperties, usePlugins } from '@/logic/store/plugins';
	import { RoomType } from '@/logic/store/rooms';
	import { FeatureFlag, useSettings } from '@/logic/store/settings';
	import { useDialog, useHubSettings, useRooms } from '@/logic/store/store';
	import { useUser } from '@/logic/store/user';
	import { NotificationCountType } from 'matrix-js-sdk';
	import { Room } from '@/logic/store/rooms';
	import { useI18n } from 'vue-i18n';
	import { useRouter } from 'vue-router';
	import { computed } from 'vue';

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

	const roomsLoaded = computed(() => {
		return rooms.roomsLoaded;
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
			const leaveMsg = await leaveMessageContext(roomId);
			if (room.isPrivateRoom()) {
				if (await dialog.okcancel(t('rooms.hide_sure'))) {
					await pubhubs.setPrivateRoomHiddenStateForUser(room, true);
					await router.replace({ name: 'home' });
				}
			} else {
				// Message should changed based on who (admin) is leaving the room and under which condition.
				// e.g., Admin leaves the room and he is the only member or when admin leaves the room which makes the room without adminstrator.
				if (await dialog.okcancel(t(leaveMsg))) {
					await pubhubs.leaveRoom(roomId);
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
		let icon = 'speech_bubbles';
		const plugin = plugins.hasRoomPlugin(room) as PluginProperties;
		if (plugin.icon) {
			icon = plugin.icon;
		}
		return icon;
	}
</script>
