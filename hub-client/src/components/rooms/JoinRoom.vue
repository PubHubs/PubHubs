<template>
	<Dialog :buttons="buttonsCancel" @close="close()">
		<template #header>
			{{ $t('rooms.join_room') }}
		</template>
		<FilteredList :items="rooms.visiblePublicRooms" sortby="name" :placeholder="$t('rooms.filter')" @click="joinRoom($event)">
			<template #item="{ item }">
				<div class="flex justify-between">
					<Icon :type="rooms.roomIsSecure(item.room_id) ? 'lock' : 'room'" class="flex-none mr-4 text-green group-hover:text-black"></Icon>
					<span :title="item.room_id" class="grow truncate w-100">{{ item.name }}&nbsp;</span>
					<Icon type="plus" class="flex-none"></Icon>
				</div>
			</template>
		</FilteredList>
	</Dialog>
</template>

<script setup lang="ts">
	import { onMounted } from 'vue';
	import { useRouter } from 'vue-router';
	import { TPublicRoom, useRooms } from '@/store/store';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { buttonsCancel } from '@/store/dialog';
	import { useToggleMenu } from '@/store/toggleGlobalMenu';
	import { RoomRouteName } from '@/model/rooms/TBaseRoom';

	const rooms = useRooms();
	const router = useRouter();
	const pubhubs = usePubHubs();
	const emit = defineEmits(['close']);
	const toggleMenu = useToggleMenu();

	onMounted(async () => {
		await rooms.fetchPublicRooms();
		toggleMenu.toggleGlobalMenu();
	});

	async function joinRoom(room: TPublicRoom) {
		if (rooms.roomIsSecure(room.room_id)) {
			// First go to secure room page with QR code.
			// Secure room then initiates Yivi flow which allows user to join the room.
			router.push({ name: RoomRouteName.SECURED_ROOM_ROUTE, params: { id: room.room_id } });
		} else {
			// Public room - Directly join the room and enter the room.
			await pubhubs.joinRoom(room.room_id);
			router.push({ name: RoomRouteName.PUBLIC_ROOM_ROUTE, params: { id: room.room_id } });
		}
		close();
	}

	async function close() {
		emit('close');
		toggleMenu.toggleGlobalMenu();
	}
</script>
