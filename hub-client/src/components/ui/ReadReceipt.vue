<template>
	<span v-if="numOfUsersRead > 0" class="-m-2.5 px-2.5 py-1.5 font-medium ~text-label-min/label-max dark:text-white">
		<!-- Tick icon  -->
		<Icon type="check-circle" size="sm" class="mb-1 inline" />

		<!-- Shows the text eg., Read by followed by a number  -->
		{{ numOfUsersRead > 0 ? $t('others.read_receipt') + ' ' + numOfUsersRead : ' ' }}

		<!-- Icon of single user or two users depending on the number of users -->
		<Icon v-if="numOfUsersRead === 1" type="user" size="sm" class="mb-1 inline"> </Icon>
		<Icon v-if="numOfUsersRead > 1" type="users" size="sm" class="mb-1 inline"> </Icon>

		<!-- If many users have read the message then + sign is shown -->
		{{ numOfUsersRead > 2 ? '+' : '' }}
	</span>
</template>

<script setup lang="ts">
	import { watchEffect, ref } from 'vue';
	import { useRooms } from '@/logic/store/rooms';
	import { useUser } from '@/logic/store/user';

	const currentUser = useUser();
	const rooms = useRooms();
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

	let numOfUsersRead = ref(0);

	// tracks reactive property accessed  with side effects
	watchEffect(() => {
		readByOtherUsers();
	});

	function readByOtherUsers() {
		if (!rooms.currentRoom) return;
		if (props.sender === currentUser.user.userId) {
			const readTimeStampOfUsers = getReadTimeStampForRoomUsers();

			if (!readTimeStampOfUsers) return;
			// Users whose timestamp is greater than currentTimeStamp of the user, it means they have read the message.
			numOfUsersRead.value = readTimeStampOfUsers.filter((number) => number > props.timestamp).length;
			return numOfUsersRead.value;
		}
		numOfUsersRead.value = 0;
		return numOfUsersRead.value;
	}

	// //Get read receipt timestamp of all other users.
	function getReadTimeStampForRoomUsers(): number[] {
		if (!rooms.currentRoom) return []; // Return an empty array if there's no current room

		const room = rooms.currentRoom;
		const currentUserID = currentUser.user.userId;

		// We need to get private room members list each time because new members can be added.
		const roomUsers = room.getOtherJoinedMembers();

		const readTimestamps: number[] = [];

		roomUsers.forEach((user) => {
			if (user.user && user.user.userId !== currentUserID) {
				const readReceipt = room.getReadReceiptForUserId(user.user.userId);
				if (readReceipt) {
					readTimestamps.push(readReceipt.data.ts);
				}
			}
		});

		return readTimestamps;
	}
</script>
