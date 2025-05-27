<template>
	<li
		:class="{ 'bg-background': roomIsActive || menuItemIsActive || adminMenuIsActive }"
		@click="
			click();
			room && menu.setActiveMenuItem(room.roomId);
		"
		class="h-fit rounded-lg px-4 py-2 transition-all duration-200 ease-in-out hover:bg-background"
	>
		<router-link :to="to" class="flex items-center gap-4">
			<Icon v-if="isSecuredRoom()" type="shield" :size="iconSize" />
			<Icon v-else class="" :type="icon" :size="iconSize" />
			<TruncatedText class="w-full"><slot></slot></TruncatedText>
			<Badge v-if="to.name === 'direct-msg' && newMessage > 0" color="notification" class="ml-auto flex-shrink-0">{{ newMessage }}</Badge>
		</router-link>
	</li>
</template>

<script setup lang="ts">
	import { useRouter } from 'vue-router';
	import { useMenu } from '@/logic/store/menu';
	import { Room, useRooms } from '@/logic/store/rooms';
	import { computed, PropType } from 'vue';

	import Icon from '@/components/elements/Icon.vue';
	import Badge from '../elements/Badge.vue';

	const rooms = useRooms();

	const router = useRouter();

	const menu = useMenu();

	const menuItemIsActive = computed(() => {
		if (typeof props.to === 'object' && props.to !== null && props.to.name !== undefined) {
			return menu.getMenuItemPath(props.to.name) === router.currentRoute.value.fullPath;
		}
		return false;
	});

	const roomIsActive = computed(() => {
		if (!props.room) return false;
		return props.room.roomId === router.currentRoute.value.fullPath.split('/').pop(); // full path looks like /room/room_id
	});

	const newMessage = computed(() => rooms.getTotalPrivateRoomUnreadMsgCount());

	const adminMenuIsActive = computed(() => {
		if (typeof props.to === 'object' && props.to !== null && props.to.name !== undefined) {
			return props.to['name'] === router.currentRoute.value.fullPath.split('/').pop();
		}
		return false;
	});

	const props = defineProps({
		to: {
			type: [String, Object],
			default: '',
		},
		icon: {
			type: String,
			default: 'circle',
		},
		iconSize: {
			type: String,
			default: 'base',
		},
		room: {
			type: Object as PropType<Room | undefined>, // room prop can be a Room type or undefined.
			required: false,
		},
	});

	function isSecuredRoom() {
		if (!props.room) return false;
		return props.room.isSecuredRoom();
	}

	function click() {
		router.push(props.to);
	}
</script>
