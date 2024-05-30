<template>
	<div class="pl-6 pr-8 relative">
		<Icon type="compass" class="absolute -ml-2 bg-white dark:bg-hub-background-2"></Icon>
		<FilteredList :items="rooms.visiblePublicRooms" sortby="name" :placeholder="$t('rooms.discover')" :inputClass="'pl-6'" :listClass="'-mt-[17px] border rounded-md shadow-md'" :showCompleteList="false" @click="joinRoom($event)">
			<template #item="{ item }">
				<div class="flex justify-between">
					<Icon :type="rooms.roomIsSecure(item.room_id) ? 'lock' : 'room'" class="flex-none mr-4 text-blue group-hover:text-black"></Icon>
					<span :title="item.room_id" class="grow truncate w-100">{{ item.name }}&nbsp;</span>
					<Icon type="plus" class="flex-none"></Icon>
				</div>
			</template>
		</FilteredList>
	</div>
</template>

<script setup lang="ts">
	import { onMounted } from 'vue';
	import { useRouter } from 'vue-router';
	import { TPublicRoom, useRooms } from '@/store/store';
	import { usePubHubs } from '@/core/pubhubsStore';

	const rooms = useRooms();
	const router = useRouter();
	const pubhubs = usePubHubs();
	const emit = defineEmits(['close']);

	onMounted(async () => {
		await rooms.fetchPublicRooms();
	});

	async function joinRoom(room: TPublicRoom) {
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
