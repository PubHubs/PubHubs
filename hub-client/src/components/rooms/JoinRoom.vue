<template>
	<Dialog :buttons="buttonsOk" width="w-3/6" @close="close()">
		<template #header>
			{{ $t('rooms.join_room') }}
		</template>
		<FilteredList :items="rooms.visiblePublicRooms" :placeholder="$t('rooms.filter')" @click="joinRoom($event)">
			<template #item="{ item }">
				<Icon :type="rooms.roomIsSecure(item.room_id) ? 'lock' : 'room'" class="mr-4 float-left text-green group-hover:text-black"></Icon>
				<span :title="item.room_id">{{ item.name }}</span>
				<Icon type="plus" class="float-right"></Icon>
			</template>
		</FilteredList>
	</Dialog>
</template>

<script setup lang="ts">
	import { PublicRoom, useRooms } from '@/store/store';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { useRouter } from 'vue-router';
	import { buttonsOk } from '@/store/dialog';

	const rooms = useRooms();
	const pubhubs = usePubHubs();
	const router = useRouter();
	const emit = defineEmits(['close']);

	async function joinRoom(room: PublicRoom) {
		if (rooms.roomIsSecure(room.room_id)) {
			router.push({ name: 'secure-room', params: { id: room.room_id } });
		} else {
			await pubhubs.joinRoom(room.room_id);
		}
		close();
	}

	async function close() {
		emit('close');
	}
</script>
