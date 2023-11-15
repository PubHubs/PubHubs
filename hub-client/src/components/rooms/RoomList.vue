<template>
	<Menu v-if="rooms.hasRooms">
		<template v-for="room in rooms.sortedRoomsArray">
			<div v-if="showRoom(room)" :key="room.roomId" class="group">
				<Icon type="unlink" class="cursor-pointer hover:text-red ml-2 float-right hidden group-hover:block" @click="leaveRoom(room.roomId)"></Icon>
				<router-link :to="{ name: 'room', params: { id: room.roomId } }" v-slot="{ isActive }">
					<Badge v-if="room.unreadMessages > 0" class="-ml-1 -mt-1">{{ room.unreadMessages }}</Badge>
					<MenuItem :roomInfo="room" icon="room" :active="isActive">
						<PrivateRoomName v-if="room.isPrivateRoom()" :members="room.getPrivateRoomNameMembers()"></PrivateRoomName>
						<span v-else>
							{{ room.name }}
						</span>
					</MenuItem>
				</router-link>
			</div>
		</template>
	</Menu>
</template>

<script setup lang="ts">
	import { useI18n } from 'vue-i18n';
	import { useRouter } from 'vue-router';
	import { Room, useRooms, useDialog } from '@/store/store';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { PubHubsRoomType } from '@/store/rooms';

	const { t } = useI18n();
	const router = useRouter();
	const rooms = useRooms();
	const pubhubs = usePubHubs();

	const props = defineProps({
		roomType: {
			type: String,
			default: '!' + PubHubsRoomType.PH_MESSAGES_DM,
		},
	});

	function showRoom(room: Room): Boolean {
		if (room.hidden) {
			return false;
		}
		if (props.roomType !== '') {
			if (props.roomType.charAt(0) == '!') {
				const type = props.roomType.substring(1);
				return room.getType() !== type;
			} else {
				return room.getType() == props.roomType;
			}
		}
		return true;
	}

	async function leaveRoom(roomId: string) {
		const room = rooms.room(roomId);
		if (room) {
			const dialog = useDialog();
			if (await dialog.okcancel(t('rooms.leave_sure'))) {
				await router.replace({ name: 'home' });
				const response = await pubhubs.leaveRoom(roomId);
				console.log('leave', roomId, response);
			}
		}
	}
</script>
