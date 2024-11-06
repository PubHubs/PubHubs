<template>
	<div class="flex max-w-[23rem] min-w-56 h-min rounded-md bg-white-middle text-black dark:bg-gray dark:text-white overflow-hidden cursor-pointer relative" @click="expandPillToggle()">
		<div class="absolute left-0 top-0 h-full w-3 shrink-0 bg-hub-background-5 transition-all duration-1000 ease-in-out" :class="{ 'bg-notification w-full': joinedARoom }"></div>
		<div class="flex justify-between p-2 pl-5 py-3 gap-2 w-full" :class="{ 'gap-4': expanded }">
			<div class="flex gap-4 items-center">
				<Icon :type="roomIsSecure ? 'shield' : 'speech_bubbles'" class="shrink-0"></Icon>
				<div class="grid">
					<H3 class="font-semibold overflow-hidden m-0 line-clamp-1 z-0" :class="{ 'line-clamp-3': expanded && !joinedARoom }">{{ room?.name }}</H3>
					<p v-if="joinedARoom === false" class="text-xs line-clamp-1 italic" :class="{ 'line-clamp-3': expanded }">{{ room?.topic }}</p>
					<p v-else class="text-base z-0">{{ t('rooms.joined') }}</p>
				</div>
			</div>
			<div class="grid gap-2 items-center">
				<Icon type="join_room" size="lg" class="hover:cursor-pointer hover:opacity-80" @click="joinRoom()"></Icon>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { router } from '@/core/router';
	import { ref } from 'vue';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { useI18n } from 'vue-i18n';

	const pubhubs = usePubHubs();
	const { t } = useI18n();

	const expanded = ref(false);
	const joinedARoom = ref(false);

	const props = defineProps({
		room: Object,
		roomIsSecure: Boolean,
	});

	function expandPillToggle() {
		expanded.value = !expanded.value;
	}

	async function joinRoom() {
		if (props.room?.room_id) {
			if (props.roomIsSecure === true) {
				router.push({ name: 'secure-room', params: { id: props.room.room_id } });
			} else {
				joinedARoom.value = true;
				setTimeout(() => {
					pubhubs.joinRoom(props.room?.room_id);
				}, 3000);
			}
		}
	}
</script>
