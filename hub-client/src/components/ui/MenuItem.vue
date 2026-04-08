<template>
	<li
		role="menuitem"
		:class="{ 'bg-surface-low text-accent-blue': roomIsActive || menuItemIsActive || adminMenuIsActive }"
		class="hover:bg-surface-low rounded-base h-fit transition-all duration-200 ease-in-out"
		@click="handleClick"
	>
		<router-link
			:to="to"
			class="flex items-center gap-4 px-4 py-2"
		>
			<Icon
				class=""
				:type="icon"
				:size="iconSize"
			/>
			<TruncatedText class="w-full"><slot></slot></TruncatedText>
			<Badge
				v-if="typeof to === 'object' && to !== null && 'name' in to && to.name === 'direct-msg' && newMessage > 0"
				class="ml-auto shrink-0"
				color="hub"
				:size="badgeSize(newMessage)"
			/>
		</router-link>
	</li>
</template>

<script setup lang="ts">
	// Packages
	import { type PropType, computed } from 'vue';
	import { useRouter } from 'vue-router';

	// Components
	import Badge from '@hub-client/components/elements/Badge.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';

	// Composables
	import useGlobalScroll from '@hub-client/composables/useGlobalScroll';
	import { useSidebar } from '@hub-client/composables/useSidebar';

	// Logic
	import { badgeSize } from '@hub-client/logic/utils/badgeUtils';

	// Models
	import { type RoomListRoom } from '@hub-client/models/rooms/TBaseRoom';

	// Stores
	import { useMenu } from '@hub-client/stores/menu';
	import { useRooms } from '@hub-client/stores/rooms';

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
			default: undefined,
		},
	});
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

	const newMessage = computed(() => {
		void rooms.unreadCountVersion;
		return rooms.getTotalPrivateRoomUnreadMsgCount();
	});

	const roomIsActive = computed(() => {
		if (!props.room) return false;
		const pathRoomId = router.currentRoute.value.path.split('/').pop();
		return props.room.roomId === decodeURIComponent(pathRoomId || '');
	});

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
</script>
