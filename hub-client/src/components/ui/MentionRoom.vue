<template>
	<div v-if="isVisible" ref="elContainer" :style="getStyle()" class="scrollbar bg-surface fixed max-h-52 overflow-x-hidden overflow-y-auto rounded-lg shadow-lg">
		<ul>
			<li v-for="(room, index) in filteredRooms" :key="index" class="group hover:bg-surface-high flex cursor-pointer px-4" @click.stop="clickedItem(room)">
				<div class="flex max-w-3000 flex-col items-center py-2">
					<TruncatedText :title="room.name">{{ room.name }}</TruncatedText> <TruncatedText class="text-on-surface-dim">{{ shortId(room.room_id) }} </TruncatedText>
				</div>
			</li>
		</ul>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed, onMounted, ref, watch } from 'vue';

	import TruncatedText from '@hub-client/components/elements/TruncatedText.vue';

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
	const roomsStore = useRooms();
	const elContainer = ref<HTMLElement | null>(null);

	let rooms = ref([] as TPublicRoom[]);

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
		/* If the current message includes a #, we need to get all other rooms
		 when it does not, we keep the room-dialog invisible */
		if (props.msg?.includes('#')) {
			rooms.value = roomsStore.publicRooms.filter((room) => room.room_id !== props.room.roomId) || [];

			/* Check at which position the # is and if there is a list of
			 filtered rooms to check if we must display the dialog */
			if (props.msg?.endsWith('#')) {
				positionOfAt.value = props.msg.length;
				isVisible.value = true;
			} else if ((props.msg?.length ?? 0) < positionOfAt.value && positionOfAt.value > 0) {
				positionOfAt.value = 0;
				isVisible.value = false;
			} else if (filteredRooms.value.length) {
				isVisible.value = true;
			}
		} else {
			isVisible.value = false;
		}
	}

	const filteredRooms = computed(() => {
		const query = props.msg ?? '';

		if (query.endsWith('#')) {
			return displayAllRooms();
		} else {
			return filterRooms(query);
		}
	});

	function displayAllRooms() {
		return rooms.value;
	}

	function filterRooms(searchQuery: string) {
		const query = searchQuery.slice(searchQuery.lastIndexOf('#') + 1);
		return roomsStore.visiblePublicRooms.filter((room) => room.name?.toLowerCase().includes(query.toLowerCase()) || room.topic?.toLowerCase().includes(query.toLowerCase()));
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
	function shortId(id: string): string | null {
		const idRegex = /([^:]+):/g;
		const result = idRegex.exec(id);
		return result ? result[1] : null;
	}
</script>
