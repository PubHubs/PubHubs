<template>
	<div v-if="isVisible" ref="elContainer" :style="getStyle()" class="scrollbar fixed max-h-52 w-fit overflow-y-auto rounded-lg bg-surface shadow-lg">
		<ul>
			<li v-for="(member, index) in filteredUsers" :key="index" class="group cursor-pointer px-4 hover:bg-surface-high" @click.stop="clickedItem(member)">
				<div class="flex items-center gap-4 py-2">
					<Avatar :userId="member.userId" />
					<div>{{ member.rawDisplayName }}</div>
				</div>
			</li>
		</ul>
	</div>
</template>

<script setup lang="ts">
	import Room from '@/model/rooms/Room';
	import { TRoomMember } from '@/model/rooms/TRoomMember';
	import { useRooms } from '@/logic/store/store';
	import { computed, onMounted, ref, watch } from 'vue';

	import Avatar from './Avatar.vue';

	const emit = defineEmits(['click']);

	const isVisible = ref(false);

	// position of @-sign of user in the current message
	const positionOfAt = ref(0);

	const rooms = useRooms();
	let users = ref([] as TRoomMember[]);
	const elContainer = ref<HTMLElement | null>(null);

	type Props = {
		msg?: string;
		left: number;
		top: number;
		room: Room;
	};

	const props = withDefaults(defineProps<Props>(), {
		msg: undefined,
		left: 0,
		top: 0,
		room: undefined,
	});

	onMounted(() => {
		initUserMention();
	});

	// watch for changes in the props.msg to control visibility
	watch(
		() => props.msg,
		() => {
			initUserMention();
		},
	);

	function initUserMention() {
		// if the current message includes a @, we need to get all other users in the room
		// when it does not, we keep the user-dialog invisible
		if (props.msg?.includes('@')) {
			users.value = rooms.currentRoom?.getOtherJoinedMembers() || [];

			// check at which position the @ is and if there is a list of
			// filtered users to check if we must display the dialog
			if (props.msg?.endsWith('@')) {
				positionOfAt.value = props.msg.length;
				isVisible.value = true;
			} else if ((props.msg?.length ?? 0) < positionOfAt.value && positionOfAt.value > 0) {
				positionOfAt.value = 0;
				isVisible.value = false;
			} else if (filteredUsers.value.length > 0) {
				isVisible.value = true;
			}
		} else {
			isVisible.value = false;
		}
	}

	const filteredUsers = computed(() => {
		const query = props.msg ?? '';

		if (query.endsWith('@')) {
			return displayAllUsers();
		} else {
			return filterUsers(query);
		}
	});

	function displayAllUsers() {
		return users.value;
	}

	function filterUsers(query: string) {
		const searchTerm = query.slice(query.lastIndexOf('@') + 1);
		const newUserList = users.value.filter((user) => user.rawDisplayName !== undefined && user.rawDisplayName.toLowerCase().includes(searchTerm.toLowerCase()));
		return newUserList;
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
