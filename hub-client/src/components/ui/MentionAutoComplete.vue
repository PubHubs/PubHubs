<template>
	<div v-if="isVisible" ref="elContainer" :style="getStyle()" class="scrollbar bg-surface fixed max-h-52 overflow-x-hidden overflow-y-auto rounded-lg shadow-lg">
		<ul>
			<li v-for="(item, index) in filteredItems" :key="index" class="group hover:bg-surface-high flex cursor-pointer items-center gap-2 px-4" @click.stop="clickedItem(item)">
				<Avatar v-if="marker === '@' && isUser(item)" :avatar-url="user.userAvatar(item.userId)" :user-id="item.userId"></Avatar>
				<div class="flex max-w-3000 flex-col items-center py-2">
					<TruncatedText :title="getDisplayName(item)">{{ getDisplayName(item) }}</TruncatedText>
					<TruncatedText class="text-on-surface-dim">{{ shortId(getId(item)) }}</TruncatedText>
				</div>
			</li>
		</ul>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed, onMounted, ref, watch } from 'vue';

	import TruncatedText from '@hub-client/components/elements/TruncatedText.vue';
	// Components
	import Avatar from '@hub-client/components/ui/Avatar.vue';

	// Models
	import Room from '@hub-client/models/rooms/Room';
	import { TRoomMember } from '@hub-client/models/rooms/TRoomMember';

	// Stores
	import { TPublicRoom, useRooms } from '@hub-client/stores/rooms';
	import { useUser } from '@hub-client/stores/user';

	// Types
	type Props = {
		msg?: string;
		left: number;
		top: number;
		room: Room;
	};

	const user = useUser();
	const emit = defineEmits(['click']);
	const isVisible = ref(false);
	const positionOfMarker = ref(0);
	const roomsStore = useRooms();
	const elContainer = ref<HTMLElement | null>(null);
	const items = ref<(TRoomMember | TPublicRoom)[]>([]);

	const props = withDefaults(defineProps<Props>(), {
		msg: undefined,
		left: 0,
		top: 0,
		room: undefined,
	});

	// Determine mention type based on which marker appears last in the message
	const marker = computed<'@' | '#' | null>(() => {
		const msg = props.msg || '';
		const lastAt = msg.lastIndexOf('@');
		const lastHash = msg.lastIndexOf('#');

		if (lastAt > lastHash && lastAt !== -1) {
			return '@';
		} else if (lastHash > lastAt && lastHash !== -1) {
			return '#';
		}
		return null;
	});

	onMounted(() => {
		initMention();
	});

	// Watch for changes in the props.msg to control visibility
	watch(
		() => props.msg,
		() => {
			initMention();
		},
	);
	/**
	 * Initializes mention detection and controls the visibility of the autocomplete.
	 *
	 * - Determines whether the current message contains a valid marker (`@` or `#`).
	 * - Loads the appropriate items when a mention starts.
	 * - Tracks the marker position to know whether the mention context is still active.
	 * - Shows or hides the dropdown based on typing state and filtered results.
	 */
	function initMention() {
		// If we don't have a valid mention type, hide the component
		if (!marker.value) {
			isVisible.value = false;
			return;
		}

		// If the current message includes the marker, we need to get all items
		if (props.msg?.includes(marker.value)) {
			loadItems();

			// Check at which position the marker is and if there is a list of
			// filtered items to check if we must display the dialog
			if (props.msg?.endsWith(marker.value)) {
				positionOfMarker.value = props.msg.length;
				isVisible.value = true;
			} else if ((props.msg?.length ?? 0) < positionOfMarker.value && positionOfMarker.value > 0) {
				positionOfMarker.value = 0;
				isVisible.value = false;
			} else if (filteredItems.value.length > 0) {
				isVisible.value = true;
			}
		} else {
			isVisible.value = false;
		}
	}
	/**
	 * Loads the full list of selectable items based on the current mention marker.
	 *
	 * - For user mentions (@)': loads all other members of the current room.
	 * - For room mentions (#): loads all public rooms except the current one.
	 *
	 * The result populates `items.value` and becomes the base list
	 * for filtering in the autocomplete.
	 */
	function loadItems(): void {
		switch (marker.value) {
			case '@':
				items.value = roomsStore.currentRoom?.getOtherJoinedMembers() || [];
				return;
			case '#':
				items.value = roomsStore.publicRooms.filter((room) => room.room_id !== props.room.roomId) || [];
				return;
			default:
				items.value = [];
				return;
		}
	}

	const filteredItems = computed(() => {
		if (!marker.value) return [];
		const query = props.msg ?? '';
		if (query.endsWith(marker.value)) {
			return items.value;
		} else {
			return filterItems(query);
		}
	});
	/**
	 * Filters the loaded items based on the user's search query.
	 *
	 * The search term is taken from the text after the last marker.
	 *
	 * - For user mentions (@): matches against member's `rawDisplayName`.
	 * - For room mentions (#): matches against room's `name` or `topic`.
	 *
	 * @param query The full message text typed by the user.
	 * @returns A filtered array of TRoomMember or TPublicRoom items.
	 */
	function filterItems(query: string): [] | TRoomMember[] | TPublicRoom[] {
		if (!marker.value) return [];
		const searchTerm = query.slice(query.lastIndexOf(marker.value) + 1).toLowerCase();

		switch (marker.value) {
			case '@':
				return (items.value as TRoomMember[]).filter((user) => user.rawDisplayName && user.rawDisplayName.toLowerCase().includes(searchTerm));
			case '#':
				return (items.value as TPublicRoom[]).filter((room) => room.name?.toLowerCase().includes(searchTerm) || room.topic?.toLowerCase().includes(searchTerm));
			default:
				return [];
		}
	}
	/**
	 * Handles the selection of an autocomplete item.
	 */
	function clickedItem(item: TRoomMember | TPublicRoom) {
		emit('click', item, marker.value);
		positionOfMarker.value = 0;
	}

	function getStyle() {
		if (!elContainer.value) return;
		return {
			left: `${props.left}px`,
			top: `${props.top - 40 - elContainer.value.clientHeight}px`,
		};
	}
	/**
	 * Creates a short, human-readable ID from a full Matrix ID.
	 *
	 * Extracts the substring before the first colon.
	 *
	 * @param id A full userId or roomId.
	 * @returns The shortened ID, or null if not matched.
	 */
	function shortId(id: string): string | null {
		const idRegex = /([^:]+):/g;
		const result = idRegex.exec(id);
		return result ? result[1] : null;
	}
	/**
	 * Returns the proper display name for a user or room.
	 *
	 * - For user mentions (@): returns the member's `rawDisplayName`.
	 * - For room mentions (#): returns the room's `name`.
	 */
	function getDisplayName(item: TRoomMember | TPublicRoom): string {
		switch (marker.value) {
			case '@':
				return (item as TRoomMember).rawDisplayName || '';
			case '#':
				return (item as TPublicRoom).name || '';
			default:
				return '';
		}
	}
	/**
	 * Returns the identifier for the given autocomplete item.
	 *
	 * - For user mentions (@):  returns the member's `userId`
	 * - For room mentions (#): returns the room's `room_id`
	 */
	function getId(item: TRoomMember | TPublicRoom): string {
		switch (marker.value) {
			case '@':
				return (item as TRoomMember).userId || '';
			case '#':
				return (item as TPublicRoom).room_id || '';
			default:
				return '';
		}
	}
	/**
	 * Type guard that checks whether an item is a TRoomMember.
	 *
	 * @param item The item to check.
	 * @returns True if `item` is a user (TRoomMember), false if it's a room.
	 */
	function isUser(item: TRoomMember | TPublicRoom): item is TRoomMember {
		return 'userId' in item;
	}
</script>
