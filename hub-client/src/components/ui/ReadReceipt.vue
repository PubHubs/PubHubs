<template>
	<span
		v-if="numOfUsersRead > 0"
		class="text-label font-medium dark:text-white"
	>
		<!-- Tick icon  -->
		<Icon
			class="mb-050 inline"
			size="sm"
			type="check-circle"
		/>

		<!-- Shows the text eg., Read by followed by a number  -->
		{{ numOfUsersRead > 0 ? $t('others.read_receipt') + ' ' + numOfUsersRead : ' ' }}

		<!-- Icon of single user or two users depending on the number of users -->
		<Icon
			v-if="numOfUsersRead === 1"
			class="mb-050 inline"
			size="sm"
			type="user"
		/>
		<Icon
			v-if="numOfUsersRead > 1"
			class="mb-050 inline"
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

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';

	// Logic
	import { getOtherRoomMembers } from '@hub-client/logic/utils/roomUtils';

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
		if (!rooms.currentRoom) return [];

		const room = rooms.currentRoom;
		const otherMembers = getOtherRoomMembers(room, currentUser.userId);

		const readTimestamps: number[] = [];

		for (const userId of otherMembers) {
			const readReceipt = room.getReadReceiptForUserId(userId);
			if (readReceipt) {
				readTimestamps.push(readReceipt.data.ts);
			}
		}

		return readTimestamps;
	}
</script>
