<template>
	<li
		:class="{ 'bg-background': isActive }"
		@click="
			click();
			menu.setActiveMenuItem(props.roomInfo?.roomId);
		"
		class="h-fit rounded-lg px-4 py-2 transition-all duration-200 ease-in-out hover:bg-background"
	>
		<router-link :to="to" class="flex items-center gap-4">
			<Icon v-if="isSecuredRoom()" type="shield" :size="iconSize" />
			<Icon v-else class="" :type="icon" :size="iconSize" />
			<TruncatedText class="w-full"><slot></slot></TruncatedText>
		</router-link>
	</li>
</template>

<script setup lang="ts">
	import { useRouter } from 'vue-router';
	import { useMenu } from '@/logic/store/menu';
	import { Room } from '@/logic/store/rooms';
	import { useRooms } from '@/logic/store/store';
	import { computed } from 'vue';
	import Icon from '@/components/elements/Icon.vue';

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
		iconSize: {
			type: String,
			default: 'base',
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
