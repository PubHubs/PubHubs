<template>
	<div class="relative flex h-min min-w-56 max-w-[23rem] cursor-pointer overflow-hidden rounded-md bg-white-middle text-black dark:bg-gray dark:text-white" @click="expandPillToggle()">
		<div class="absolute left-0 top-0 h-full w-3 shrink-0 bg-hub-background-5 transition-all duration-1000 ease-in-out" :class="{ 'w-full bg-notification': joinedARoom }"></div>
		<div class="flex w-full justify-between gap-2 p-2 py-3 pl-5" :class="{ 'gap-4': expanded }">
			<div class="flex items-center gap-4">
				<Icon :type="roomIsSecure ? 'shield' : 'speech_bubbles'" class="shrink-0"></Icon>
				<div class="grid">
					<H3 class="z-0 m-0 line-clamp-1 overflow-hidden font-semibold" :class="{ 'line-clamp-3': expanded && !joinedARoom }">{{ room?.name }}</H3>
					<p v-if="joinedARoom === false" class="line-clamp-1 text-xs italic" :class="{ 'line-clamp-3': expanded }">{{ room.topic }}</p>
					<p v-else class="z-0 text-base">{{ t('rooms.joined') }}</p>
				</div>
			</div>
			<div class="grid items-center gap-2">
				<Icon v-if="memberOfRoom" type="arrow-right" size="lg" class="z-0 hover:cursor-pointer hover:opacity-80" @click="goToRoom()"></Icon>
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
