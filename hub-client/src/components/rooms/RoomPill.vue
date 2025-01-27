<template>
	<div class="flex max-w-[23rem] min-w-56 h-min rounded-md bg-white-middle text-black dark:bg-gray dark:text-white overflow-hidden cursor-pointer relative" @click="expandPillToggle()">
		<div class="absolute left-0 top-0 h-full w-3 shrink-0 bg-hub-background-5 transition-all duration-1000 ease-in-out" :class="{ 'bg-notification w-full': joinedARoom }"></div>
		<div class="flex justify-between p-2 pl-5 py-3 gap-2 w-full" :class="{ 'gap-4': expanded }">
			<div class="flex gap-4 items-center">
				<Icon :type="roomIsSecure ? 'shield' : 'speech_bubbles'" class="shrink-0"></Icon>
				<div class="grid">
					<H3 class="font-semibold overflow-hidden m-0 line-clamp-1 z-0" :class="{ 'line-clamp-3': expanded && !joinedARoom }">{{ room?.name }}</H3>
					<p v-if="joinedARoom === false" class="text-xs line-clamp-1 italic" :class="{ 'line-clamp-3': expanded }">{{ room.topic }}</p>
					<p v-else class="text-base z-0">{{ t('rooms.joined') }}</p>
				</div>
			</div>
			<div class="grid gap-2 items-center">
				<Icon v-if="memberOfRoom" type="arrow-right" size="lg" class="hover:cursor-pointer hover:opacity-80 z-0" @click="goToRoom()"></Icon>
				<Icon v-if="!memberOfRoom" type="join_room" size="lg" class="hover:cursor-pointer hover:opacity-80" @click="joinRoom()"></Icon>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Components
	import Icon from '../elements/Icon.vue';
	import H3 from '../elements/H3.vue';

	import { ref } from 'vue';
	import { router } from '@/core/router';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { useI18n } from 'vue-i18n';
	import { TPublicRoom } from '@/store/rooms';

	const pubhubs = usePubHubs();
	const { t } = useI18n();

	const expanded = ref(false);
	const joinedARoom = ref(false);

	type Props = {
		room: TPublicRoom;
		roomIsSecure: boolean;
		memberOfRoom: boolean;
	};

	const props = defineProps<Props>();

	function expandPillToggle() {
		expanded.value = !expanded.value;
	}

	async function joinRoom() {
		if (props.roomIsSecure) {
			router.push({ name: 'secure-room', params: { id: props.room.room_id } });
		} else {
			joinedARoom.value = true;
			setTimeout(() => {
				pubhubs.joinRoom(props.room.room_id);
			}, 1000);
		}
	}

	function goToRoom() {
		router.push({ name: 'room', params: { id: props.room.room_id } });
	}
</script>
