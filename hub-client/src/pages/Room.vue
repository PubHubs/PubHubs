<template>
	<HeaderFooter v-if="rooms.currentRoomExists" class="pl-3">
		<template #header>
			<div class="flex">
				<div v-if="currentRoom">
					<Icon :type="rooms.roomIsSecure(currentRoom.roomId) ? 'lock' : 'room'" class="text-blue mt-2" size="lg"></Icon>
					<div class="pl-3">
						<H1 class="m-0 text-blue font-bold">{{ $t('rooms.title', [roomName()]) }}</H1>
						<p class="text-sm leading-4">
							<PrivateRoomName v-if="currentRoom.isPrivateRoom()" :members="members"></PrivateRoomName>
							<span v-else>
								{{ getTopic() }}
							</span>
						</p>
					</div>
				</div>
				<SearchInput class="ml-16 mt-6 flex-auto" @submit="search"></SearchInput>
			</div>
		</template>

		<RoomTimeline class="pt-12 pb-3" :room_id="rooms.currentRoomId"></RoomTimeline>

		<template #footer>
			<MessageInput @submit="addMessage($event)"></MessageInput>
		</template>
	</HeaderFooter>
</template>

<script setup lang="ts">
	import { onMounted, watch, ref } from 'vue';
	import { useRoute } from 'vue-router';
	import { useI18n } from 'vue-i18n';
	import { Room, useRooms } from '@/store/store';
	import { usePubHubs } from '@/core/pubhubsStore';

	const route = useRoute();
	const { t } = useI18n();
	const rooms = useRooms();
	const pubhubs = usePubHubs();

	const currentRoom = ref({} as Room);
	const members = ref([] as Array<String>);

	onMounted(() => {
		update();
	});

	watch(route, () => {
		update();
	});

	function update() {
		rooms.changeRoom(route.params.id as string);
		currentRoom.value = rooms.currentRoom as Room;
		if (currentRoom.value) {
			members.value = currentRoom.value.getPrivateRoomNameMembers();
		}
	}

	function roomName() {
		if (currentRoom.value.isPrivateRoom()) {
			return t('rooms.private_room', members.value);
		}
		return currentRoom.value.name;
	}

	function getTopic() {
		if (currentRoom.value.isPrivateRoom()) {
			return t('rooms.private_members', members.value);
		}
		const topicEvent = currentRoom.value.currentState.getStateEvents('m.room.topic', '');
		if (topicEvent) {
			return topicEvent.getContent().topic;
		}
		return '';
	}

	function addMessage(text: string) {
		pubhubs.addMessage(rooms.currentRoomId, text);
	}

	function search(term: string) {
		alert(t('others.nop') + '[' + term + ']');
	}
</script>
