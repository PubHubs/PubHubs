<template>
	<div class="flex max-w-[22rem] min-w-56 h-min rounded-md bg-white-middle text-black dark:bg-gray dark:text-white overflow-hidden" @mouseleave="expanded = false">
		<div class="w-3 shrink-0 bg-hub-background-5"></div>
		<div class="flex justify-between p-2 py-3 gap-2 w-full" :class="{ 'gap-4': expanded }">
			<div class="flex gap-4 items-center">
				<Icon :type="roomIsSecure ? 'shield' : 'speech_bubbles'" class="shrink-0"></Icon>
				<div class="grid gap-0">
					<H3 class="font-semibold line-clamp-1 m-0" :class="{ 'line-clamp-2': expanded }">{{ room?.name }}</H3>
					<p class="text-xs line-clamp-1 italic" :class="{ 'line-clamp-3': expanded }">{{ room?.topic }}</p>
				</div>
			</div>
			<div class="grid gap-2 items-center">
				<div class="bg-hub-background rounded-md h-min hover:opacity-80">
					<Icon type="chevron-down" class="hover:cursor-pointer transition-all" :class="{ 'rotate-180': expanded }" size="lg" @click="expandPillToggle()"></Icon>
				</div>
				<Icon type="join_room" size="lg" class="hover:cursor-pointer hover:opacity-80" :class="{ hidden: !expanded }" @click="joinRoom()"></Icon>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { router } from '@/core/router';
	import { ref } from 'vue';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { useDialog } from '@/store/dialog';
	import { useI18n } from 'vue-i18n';

	const pubhubs = usePubHubs();
	const { t } = useI18n();

	let expanded = ref(false);
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
				const dialog = useDialog();
				if (await dialog.okcancel(t('rooms.join_sure'), t('admin.name') + ': ' + props.room.name)) {
					await pubhubs.joinRoom(props.room.room_id);
				}
			}
		}
	}
</script>
