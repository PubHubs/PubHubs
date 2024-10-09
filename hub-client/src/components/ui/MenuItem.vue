<template>
	<li class="menu-item h-11 pl-5 pr-8 hover:dark:bg-gray-middle hover:bg-lightgray py-2 transition-all duration-150 ease-in-out">
		<router-link :to="to" class="flex gap-2 items-center">
			<Icon v-if="isSecuredRoom()" type="shield" class="shrink-0"></Icon>
			<Icon v-else class="shrink-0 text-blue dark:text-green" :type="icon"></Icon>
			<TruncatedText class="w-full"><slot></slot></TruncatedText>
		</router-link>
	</li>
</template>

<script setup lang="ts">
	import { Room } from '@/store/rooms';
	import { useRooms } from '@/store/store';

	const rooms = useRooms();

	const props = defineProps({
		to: {
			type: [String, Object],
			default: '',
		},
		icon: {
			type: String,
			default: 'circle',
		},
		// active: {
		// 	type: Boolean,
		// 	default: false,
		// },
		roomInfo: {
			type: [Room, Object],
			default: Object,
		},
	});

	function isSecuredRoom() {
		if (props.roomInfo?.roomId !== undefined) {
			return rooms.roomIsSecure(props.roomInfo.roomId);
		}
		return false;
	}
</script>
