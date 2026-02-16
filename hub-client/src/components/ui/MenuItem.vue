<template>
	<li role="menuitem" :class="{ 'bg-surface-low': roomIsActive || menuItemIsActive || adminMenuIsActive }" @click="handleClick" class="hover:bg-surface-low rounded-base h-fit px-4 py-2 transition-all duration-200 ease-in-out">
		<router-link :to="to" class="flex items-center gap-4">
			<Icon v-if="isSecuredRoom()" type="shield" :size="iconSize" />
			<Icon v-else class="" :type="icon" :size="iconSize" />
			<TruncatedText class="w-full"><slot></slot></TruncatedText>
			<Badge v-if="to.name === 'direct-msg' && newMessage > 0" class="ml-auto shrink-0">{{ newMessage }}</Badge>
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

	// Composables
	import useGlobalScroll from '@hub-client/composables/useGlobalScroll';
	import { useSidebar } from '@hub-client/composables/useSidebar';

	// Models
	import { RoomListRoom, RoomType, SecuredRooms } from '@hub-client/models/rooms/TBaseRoom';

	// Stores
	import { useMenu } from '@hub-client/stores/menu';
	import { useRooms } from '@hub-client/stores/rooms';

	const menu = useMenu();
	const rooms = useRooms();
	const router = useRouter();
	const sidebar = useSidebar();
	const { scrollToEnd } = useGlobalScroll();

	const adminMenuIsActive = computed(() => {
		if (typeof props.to === 'object' && props.to !== null && props.to.name !== undefined) {
			return props.to['name'] === router.currentRoute.value.path.split('/').pop();
		}
		return false;
	});

	const menuItemIsActive = computed(() => {
		if (typeof props.to === 'object' && props.to !== null && props.to.name !== undefined) {
			return menu.getMenuItemPath(props.to.name) === router.currentRoute.value.path;
		}
		return false;
	});

	const newMessage = computed(() => rooms.getTotalPrivateRoomUnreadMsgCount());

	const roomIsActive = computed(() => {
		if (!props.room) return false;
		const pathRoomId = router.currentRoute.value.path.split('/').pop();
		return props.room.roomId === decodeURIComponent(pathRoomId || '');
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
			type: Object as PropType<RoomListRoom | undefined>,
			required: false,
		},
	});

	function isSecuredRoom() {
		if (!props.room) return false;
		return SecuredRooms.includes(props.room.roomType as RoomType);
	}

	function handleClick() {
		scrollToEnd();
		if (props.room) {
			menu.setActiveMenuItem(props.room.roomId);
		}
		// Mobile only: Close sidebar when navigating to DM page (so mobile shows conversation list, not last open DM)
		if (typeof props.to === 'object' && props.to !== null && props.to.name === 'direct-msg' && sidebar.isMobile.value) {
			sidebar.close();
			sidebar.clearLastDMRoom();
		}
	}

	function click() {
		router.push(props.to);
	}
</script>
