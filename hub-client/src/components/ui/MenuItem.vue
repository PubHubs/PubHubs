<template>
	<li class="menu-item px-5 hover:dark:bg-gray-middle hover:bg-lightgray py-2 transition-all duration-150 ease-in-out">
		<Icon v-if="isSecuredRoom()" type="lock" class="mr-4 float-left text-blue dark:text-green"></Icon>
		<Icon v-else class="mr-4 float-left text-blue dark:text-green" :type="icon"></Icon>
		<TruncatedText><slot></slot></TruncatedText>
	</li>
</template>

<script setup lang="ts">
	import { Room } from '@/store/rooms';
	import { useRooms } from '@/store/store';

	const rooms = useRooms();

	const props = defineProps({
		icon: {
			type: String,
			default: 'circle',
		},
		active: {
			type: Boolean,
			default: false,
		},
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
