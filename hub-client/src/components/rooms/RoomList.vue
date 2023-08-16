<template>
	<Menu v-if="rooms.hasRooms">
		<template v-for="room in rooms.sortedRoomsArray">
			<div v-if="!room.hidden" :key="room.roomId" class="group">
				<Icon type="unlink" class="cursor-pointer hover:text-red ml-2 float-right hidden group-hover:block" @click="leaveRoom(room.roomId)"></Icon>
				<router-link :to="{ name: 'room', params: { id: room.roomId } }" v-slot="{ isActive }">
					<Badge v-if="room.unreadMessages > 0" class="-ml-1 -mt-1">{{ room.unreadMessages }}</Badge>
					<MenuItem :roomInfo="room" icon="room" :active="isActive">
						{{ room.name }}
					</MenuItem>
				</router-link>
			</div>
		</template>
	</Menu>
</template>

<script setup lang="ts">
	import { useI18n } from 'vue-i18n';
	import { useRooms, useDialog } from '@/store/store';
	import { usePubHubs } from '@/core/pubhubsStore';

	const { t } = useI18n();
	const rooms = useRooms();
	const pubhubs = usePubHubs();

	async function leaveRoom(roomId: string) {
		const dialog = useDialog();
		if (await dialog.okcancel(t('rooms.leave_sure'))) {
			pubhubs.leaveRoom(roomId);
		}
	}
</script>
