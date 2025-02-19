<template>
	<li
		:class="{ 'bg-lightgray dark:bg-gray-middle': isActive }"
		@click="
			click();
			menu.setActiveMenuItem(props.roomInfo?.roomId);
		"
		class="menu-item h-11 rounded-lg py-2 pl-5 pr-2 transition-all duration-150 ease-in-out hover:bg-lightgray hover:dark:bg-gray-middle"
	>
		<router-link :to="to" class="flex items-center gap-2">
			<Icon v-if="isSecuredRoom()" type="shield"></Icon>
			<Icon v-else class="dark:text-white" :type="icon"></Icon>
			<TruncatedText class="w-full"><slot></slot></TruncatedText>
		</router-link>
	</li>
</template>

<script setup lang="ts">
	import { useRouter } from 'vue-router';
	import { useMenu } from '@/store/menu';
	import { Room } from '@/store/rooms';
	import { useRooms } from '@/store/store';
	import { computed } from 'vue';

	const router = useRouter();
	const rooms = useRooms();
	const menu = useMenu();

	const isActive = computed(() => {
		if (props.roomInfo?.roomId) {
			return props.roomInfo?.roomId === menu.activeMenuItemId;
		} else {
			return false;
		}
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

	function click() {
		router.push(props.to);
	}
</script>
