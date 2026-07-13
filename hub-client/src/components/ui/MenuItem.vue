<template>
	<li
		:class="{ 'bg-surface-elevated text-accent-blue': isActive }"
		class="hover:bg-surface-elevated rounded-base h-fit transition-all duration-200 ease-in-out"
		:data-rail-active="isActive || undefined"
	>
		<router-link
			v-slot="{ href, navigate }"
			custom
			:to="to"
		>
			<a
				class="flex items-center gap-200 px-200 py-100"
				:href="href"
				:aria-current="isActive ? 'true' : undefined"
				:aria-disabled="isActive ? 'true' : undefined"
				@click="
					navigate($event);
					handleClick();
				"
			>
				<Icon
					class=""
					:type="icon"
					:size="iconSize"
				/>
				<TruncatedText class="w-full"><slot></slot></TruncatedText>
				<Badge
					v-if="typeof to === 'object' && to !== null && 'name' in to && to.name === 'direct-msg' && dmUnreadState === 'unread'"
					class="ml-auto shrink-0"
					color="hub"
					size="sm"
				/>
				<Badge
					v-if="typeof to === 'object' && to !== null && 'name' in to && to.name === 'direct-msg' && dmUnreadState === 'unknown'"
					class="ml-auto shrink-0"
					color="unknown"
					size="sm"
				/>
			</a>
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
	import TruncatedText from '@hub-client/components/elements/TruncatedText.vue';

	// Composables
	import useGlobalScroll from '@hub-client/composables/useGlobalScroll';
	import { useSidebar } from '@hub-client/composables/useSidebar';

	// Logic
	import { isVisiblePrivateRoom } from '@hub-client/logic/core/privateRoomNames';

	// Models
	import { type RoomListRoom, worstUnreadState } from '@hub-client/models/rooms/TBaseRoom';

	// Stores
	import { useMenu } from '@hub-client/stores/menu';
	import { useRooms } from '@hub-client/stores/rooms';
	import { useUser } from '@hub-client/stores/user';

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
			// Room items all share the 'room' route and are matched by id in roomIsActive instead.
			return !props.room && props.to['name'] === router.currentRoute.value.name;
		}
		return false;
	});

	const menuItemIsActive = computed(() => {
		if (typeof props.to === 'object' && props.to !== null && props.to.name !== undefined) {
			return menu.getMenuItemPath(props.to.name) === router.currentRoute.value.path;
		}
		return false;
	});

	const currentUser = useUser();

	const dmUnreadState = computed(() => {
		return worstUnreadState(
			rooms.loadedPrivateRooms.filter((r) => !r.isHidden && isVisiblePrivateRoom(r.name, currentUser.user.userId)).map((r) => r.unreadState),
		);
	});

	const roomIsActive = computed(() => {
		if (!props.room) return false;
		const pathRoomId = router.currentRoute.value.path.split('/').pop();
		return props.room.roomId === decodeURIComponent(pathRoomId || '');
	});

	const isActive = computed(() => roomIsActive.value || menuItemIsActive.value || adminMenuIsActive.value);

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
