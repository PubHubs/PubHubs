<template>
	<Dialog :buttons="buttonsCancel" width="lg:w-3/6 md:5/6 xs:w-full" @close="close()">
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
	import { PublicRoom, useRooms } from '@/store/store';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { buttonsCancel } from '@/store/dialog';

	const rooms = useRooms();
	const pubhubs = usePubHubs();
	const router = useRouter();
	const emit = defineEmits(['close']);

	onMounted(async () => {
		await rooms.fetchPublicRooms();
	});

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
