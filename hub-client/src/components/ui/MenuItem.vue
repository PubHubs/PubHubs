<template>
	<li
		role="menuitem"
		:class="{ 'bg-background': roomIsActive || menuItemIsActive || adminMenuIsActive }"
		@click="
			scrollToEnd();
			room && menu.setActiveMenuItem(room.roomId);
		"
		class="hover:bg-background h-fit rounded-lg px-4 py-2 transition-all duration-200 ease-in-out"
	>
		<router-link :to="to" class="flex items-center gap-4">
			<Icon v-if="isSecuredRoom()" type="shield" :size="iconSize" />
			<Icon v-else class="" :type="icon" :size="iconSize" />
			<TruncatedText class="w-full"><slot></slot></TruncatedText>
			<Badge v-if="to.name === 'direct-msg' && newMessage > 0" color="notification" class="ml-auto shrink-0">{{ newMessage }}</Badge>
		</router-link>
	</li>
</template>

<script setup lang="ts">
	// Packages
	import { PropType, computed } from 'vue';
	import { useRouter } from 'vue-router';

	// Components
	import Badge from '@hub-client/components/elements/Badge.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';

	import useGlobalScroll from '@hub-client/composables/useGlobalScroll';

	// Stores
	import { useMenu } from '@hub-client/stores/menu';
	import { Room, useRooms } from '@hub-client/stores/rooms';

	const menu = useMenu();
	const rooms = useRooms();
	const router = useRouter();
	const { scrollToEnd } = useGlobalScroll();

	const adminMenuIsActive = computed(() => {
		if (typeof props.to === 'object' && props.to !== null && props.to.name !== undefined) {
			return props.to['name'] === router.currentRoute.value.fullPath.split('/').pop();
		}
		return false;
	});

	const menuItemIsActive = computed(() => {
		if (typeof props.to === 'object' && props.to !== null && props.to.name !== undefined) {
			return menu.getMenuItemPath(props.to.name) === router.currentRoute.value.fullPath;
		}
		return false;
	});

	const newMessage = computed(() => rooms.getTotalPrivateRoomUnreadMsgCount());

	const roomIsActive = computed(() => {
		if (!props.room) return false;
		return props.room.roomId === router.currentRoute.value.fullPath.split('/').pop(); // Full path looks like /room/room_id
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
			type: Object as PropType<Room | undefined>, // Room prop can be a Room type or undefined.
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
