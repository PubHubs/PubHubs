<template>
	<div v-if="visible" class="absolute mt-2 w-96 max-h-48 shadow-lg rounded-lg bottom-8 overflow-x-auto left-0 border-2 border-grey">
		<ul>
			<li v-for="(item, index) in filteredUsers" :key="index" class="group cursor-pointer hover:bg-green bg-gray-light p-1 border-b border-gray-light rounded-t-none" @click="clickedItem(item)">
				<div class="flex items-center space-x-8">
					<Avatar
						v-if="item.rawDisplayName != undefined"
						:class="bgColor(color(item.userId))"
						:userName="item.rawDisplayName"
						:img="item.avatarUrl?.slice(6) != undefined ? pubhubs.getBaseUrl + '/_matrix/media/r0/download/' + item.avatarUrl?.slice(6) : ''"
					></Avatar>
					<div>{{ item.rawDisplayName }}</div>
				</div>
			</li>
		</ul>
	</div>
</template>

<script setup lang="ts">
	import { ref, computed, watch, onMounted } from 'vue';
	import { useUserColor } from '@/composables/useUserColor';
	import { User as MatrixUser } from 'matrix-js-sdk';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { useRooms, useUser } from '@/store/store';

	const { color, bgColor } = useUserColor();
	const emit = defineEmits(['click']);

	const visible = ref(false); // Control the visibility of the user list div

	// Therefore, message Direction keeps track of the simulating backspace.
	const messageDirection = ref(0);
	const pubhubs = usePubHubs();
	const rooms = useRooms();
	const user = useUser();
	const users = ref([] as Array<MatrixUser>);
	const checkEmptyList = ref(false);
	const props = defineProps({
		msg: {
			type: String,
			default: null,
		},
	});

	onMounted(async () => {
		await getRoomMembersByRoomType();
	});

	// Watch for changes in the props.msg to control visibility
	watch(props, async () => {
		await getRoomMembersByRoomType();
		displayBoxVisibility();
	});

	const filteredUsers = computed(() => {
		const query = props.msg;
		if (query.endsWith('@')) {
			return displayAllUsers();
		} else {
			return filterUsers(query);
		}
	});

	function displayBoxVisibility() {
		// Simulating backspace or delete key with messageDirection.
		// When to

		if (props.msg.length < messageDirection.value && messageDirection.value != 0) {
			visible.value = false;
			messageDirection.value = 0;
		} else if (props.msg.endsWith('@')) {
			messageDirection.value = props.msg.length;
			visible.value = true;
			//Disable the unnecessary empty box if there are no users in search box.
		} else if (checkEmptyList.value) {
			visible.value = false;
		}
	}

	function displayAllUsers() {
		return users.value;
	}

	function filterUsers(query: string) {
		const searchTerm = query.slice(query.lastIndexOf('@') + 1);
		const newUserList = users.value.filter((user: MatrixUser) => user.rawDisplayName !== undefined && user.rawDisplayName.toLowerCase().includes(searchTerm.toLowerCase()));
		checkEmptyList.value = newUserList.length < 1 ? true : false;
		return newUserList;
	}

	async function getRoomMembersByRoomType() {
		if (rooms.currentRoom != undefined) {
			users.value = rooms.roomIsSecure(rooms.currentRoom.roomId) ? rooms.currentRoom.getPrivateRoomNameMembers() : await pubhubs.getUsers();
			users.value = users.value.filter((u) => u.userId !== user.user.userId && u.rawDisplayName != 'notices');
		}
	}

	function clickedItem(item: any) {
		emit('click', item);
		messageDirection.value = 0;
		visible.value = false; // Close the div when a user is clicked
	}
</script>
