<template>
	<li class="mb-2 menu-item">
		<Icon v-if="isSecuredRoom()" type="lock" class="mr-4 float-left text-blue dark:text-green"></Icon>
		<Icon v-else class="mr-4 float-left text-blue dark:text-green" :type="icon"></Icon>
		<TruncatedText><slot></slot></TruncatedText>
	</li>
</template>

<script setup lang="ts">
	import { onMounted } from 'vue';
	import { Room } from '@/store/rooms';
	import { useRooms } from '@/store/store';

	const rooms = useRooms();

	// Read all the unread messages in each room  when PubHubs is opened.
	onMounted(() => {
		if (rooms.hasRooms) {
			rooms.roomsArray.forEach((room) => {
				rooms.unreadMessageCounter(room.roomId, undefined);
			});
		}
	});

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
			if (rooms.roomIsSecure(props.roomInfo.roomId)) {
				return true;
			} else {
				return false;
			}
		}
		return false;
	}
</script>
