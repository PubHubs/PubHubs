<template>
	<li class="mb-2 menu-item" :class="activeClass">
		<Icon v-if="isSecuredRoom()" type="lock" class="mr-4 float-left"></Icon>
		<Icon v-else class="mr-4 float-left" :type="icon"></Icon>
		<TruncatedText><slot></slot></TruncatedText>
	</li>
</template>

<script setup lang="ts">
	import { computed, onMounted } from 'vue';
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

	const activeClass = computed(() => {
		if (props.active) {
			return 'text-blue hover:text-blue-dark';
		}
		return 'text-green hover:text-green-dark';
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
