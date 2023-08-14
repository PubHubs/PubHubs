<template>
	<Dialog :buttons="buttonsOk" width="w-3/6" @close="close($event)">
		<template #header>
			{{ $t('rooms.join_room') }}
		</template>
		<TextInput :placeholder="$t('rooms.filter')" v-model="filter" class="mb-4 w-full"></TextInput>
		<ul v-if="rooms.hasPublicRooms">
			<li v-for="room in filteredPublicRooms" :key="room.room_id" class="group cursor-pointer hover:bg-green p-1 rounded" @click="joinPublicRoom(room)">
				<Icon :type="rooms.roomIsSecure(room.room_id) ? 'lock' : 'room'" class="mr-4 float-left text-green group-hover:text-black"></Icon>
				<span :title="room.room_id">{{ room.name }}</span>
				<Icon type="plus" class="float-right"></Icon>
			</li>
		</ul>
	</Dialog>
</template>

<script setup lang="ts">
	import { computed, ref } from 'vue';
	import { PublicRoom, useRooms } from '@/store/store';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { useRouter } from 'vue-router';
	import { buttonsOk } from '@/store/dialog';

	const rooms = useRooms();
	const pubhubs = usePubHubs();
	const router = useRouter();
	const emit = defineEmits(['close']);

	const filter = ref('');

	// Filter out rooms that user is allready member off, and filter string
	const filteredPublicRooms = computed(() => {
		return rooms.publicRooms.filter((room: PublicRoom) => {
			if (rooms.roomExists(room.room_id) && !rooms.room(room.room_id)?._ph.hidden) {
				return false;
			}
			if (filter.value == '') {
				return true;
			}
			return room.name?.includes(filter.value);
		});
	});

	async function joinPublicRoom(room: PublicRoom) {
		if (rooms.roomIsSecure(room.room_id)) {
			router.push({ name: 'secure-room', params: { id: room.room_id } });
		} else {
			await pubhubs.joinPublicRoom(room);
		}
		close();
	}

	async function close() {
		emit('close');
	}
</script>
