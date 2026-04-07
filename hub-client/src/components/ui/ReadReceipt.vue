<template>
	<span
		v-if="numOfUsersRead > 0"
		class="text-label -m-2.5 px-2.5 py-1.5 font-medium dark:text-white"
	>
		<!-- Tick icon  -->
		<Icon
			class="mb-1 inline"
			size="sm"
			type="check-circle"
		/>

		<!-- Shows the text eg., Read by followed by a number  -->
		{{ numOfUsersRead > 0 ? $t('others.read_receipt') + ' ' + numOfUsersRead : ' ' }}

		<!-- Icon of single user or two users depending on the number of users -->
		<Icon
			v-if="numOfUsersRead === 1"
			class="mb-1 inline"
			size="sm"
			type="user"
		/>
		<Icon
			v-if="numOfUsersRead > 1"
			class="mb-1 inline"
			size="sm"
			type="users"
		/>

		<!-- If many users have read the message then + sign is shown -->
		{{ numOfUsersRead > 2 ? '+' : '' }}
	</span>
</template>

<script lang="ts" setup>
	// Packages
	import { ref, watchEffect } from 'vue';

	// Stores
	import { useRooms } from '@hub-client/stores/rooms';
	import { useUser } from '@hub-client/stores/user';

	const props = defineProps({
		timestamp: {
			type: Number,
			required: true,
		},
		sender: {
			type: String,
			required: true,
		},
	});
	const currentUser = useUser();
	const rooms = useRooms();
	let numOfUsersRead = ref(0);

	// Tracks reactive property accessed  with side effects
	watchEffect(() => {
		readByOtherUsers();
	});

	function readByOtherUsers() {
		if (!rooms.currentRoom) return;
		if (props.sender === currentUser.userId) {
			const readTimeStampOfUsers = getReadTimeStampForRoomUsers();

			if (!readTimeStampOfUsers) return;
			// Users whose timestamp is greater than currentTimeStamp of the user, it means they have read the message.
			numOfUsersRead.value = readTimeStampOfUsers.filter((number) => number > props.timestamp).length;
			return numOfUsersRead.value;
		}
		numOfUsersRead.value = 0;
		return numOfUsersRead.value;
	}

	// Get read receipt timestamp of all other users.
	function getReadTimeStampForRoomUsers(): number[] {
		if (!rooms.currentRoom) return []; // Return an empty array if there's no current room

		const room = rooms.currentRoom;
		const currentUserID = currentUser.userId;

		// We need to get private room members list each time because new members can be added.
		const roomUsers = room.getOtherJoinedMembers();

		const readTimestamps: number[] = [];

		roomUsers.forEach((user) => {
			if (user.user && user.userId !== currentUserID) {
				const readReceipt = room.getReadReceiptForUserId(user.userId);
				if (readReceipt) {
					readTimestamps.push(readReceipt.data.ts);
				}
			}
		});

		return readTimestamps;
	}
</script>
