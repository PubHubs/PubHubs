<template>
	<div v-if="isVisible" ref="elContainer" :style="getStyle()" class="scrollbar fixed max-h-52 w-fit overflow-y-auto rounded-lg bg-surface shadow-lg">
		<ul>
			<li v-for="(room, index) in filteredRoooms" :key="index" class="group cursor-pointer px-4 hover:bg-surface-high" @click.stop="clickedItem(room)">
				<div class="flex items-center gap-4 py-2">
					<div>{{ room.name }}</div>
				</div>
			</li>
		</ul>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed, onMounted, ref, watch } from 'vue';

	import { router } from '@hub-client/logic/core/router';

	// Models
	import Room from '@hub-client/models/rooms/Room';

	// Stores
	import { TPublicRoom, useRooms } from '@hub-client/stores/rooms';

	// Types
	type Props = {
		msg?: string;
		left: number;
		top: number;
		room: Room;
	};

	const emit = defineEmits(['click']);
	const isVisible = ref(false);
	const positionOfAt = ref(0); // Position of @-sign of user in the current message
	const rooms = useRooms();
	const elContainer = ref<HTMLElement | null>(null);

	let users = ref([] as TPublicRoom[]);

	const props = withDefaults(defineProps<Props>(), {
		msg: undefined,
		left: 0,
		top: 0,
		room: undefined,
	});

	onMounted(() => {
		initRoomMention();
	});

	// Watch for changes in the props.msg to control visibility
	watch(
		() => props.msg,
		() => {
			initRoomMention();
		},
	);

	function initRoomMention() {
		// If the current message includes a @, we need to get all other users in the room
		// when it does not, we keep the user-dialog invisible
		if (props.msg?.includes('#')) {
			rooms.fetchPublicRooms();
			users.value = rooms.publicRooms || [];

			// Check at which position the @ is and if there is a list of
			// filtered users to check if we must display the dialog
			if (props.msg?.endsWith('#')) {
				positionOfAt.value = props.msg.length;
				isVisible.value = true;
			} else if ((props.msg?.length ?? 0) < positionOfAt.value && positionOfAt.value > 0) {
				positionOfAt.value = 0;
				isVisible.value = false;
			} else if (filteredRoooms.value.length > 0) {
				isVisible.value = true;
			}
		} else {
			isVisible.value = false;
		}
	}

	const filteredRoooms = computed(() => {
		const query = props.msg ?? '';

		if (query.endsWith('#')) {
			console.error('test');
			console.error(router.currentRoute.value.fullPath);
			return displayAllRooms();
		} else {
			return filterRooms(query);
		}
	});

	function displayAllRooms() {
		console.error(users.value);
		return users.value;
	}

	function filterRooms(searchQuery: string) {
		const query = searchQuery.toLowerCase().trim();
		return rooms.visiblePublicRooms.filter((room) => room.name?.toLowerCase().includes(query) || room.topic?.toLowerCase().includes(query));
	}

	function clickedItem(item: any) {
		emit('click', item);
		positionOfAt.value = 0;
	}

	function getStyle() {
		if (!elContainer.value) return;
		return {
			left: `${props.left}px`,
			top: `${props.top - 40 - elContainer.value.clientHeight}px`,
		};
	}
</script>
