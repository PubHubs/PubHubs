<template>
	<Dialog :buttons="buttonsOk" width="w-3/6" @close="close()">
		<template #header>
			{{ $t('rooms.private_add') }}
		</template>
		<FilteredList :items="users" filterKey="displayName" :placeholder="$t('rooms.private_search_user')" @click="addNewPrivateRoom($event)">
			<template #item="{ item }">
				<span :title="item.userId">{{ item.displayName }}</span>
				<Icon type="plus" class="float-right"></Icon>
			</template>
		</FilteredList>
	</Dialog>
</template>

<script setup lang="ts">
	import { ref, onMounted } from 'vue';
	import { User as MatrixUser } from 'matrix-js-sdk';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { User, useUser, PubHubsRoomType, useRooms } from '@/store/store';
	import { buttonsOk } from '@/store/dialog';

	const pubhubs = usePubHubs();
	const user = useUser();
	const emit = defineEmits(['close']);

	const users = ref([] as Array<MatrixUser>);

	onMounted(async () => {
		users.value = await pubhubs.getUsers();
		// Remove self from list
		users.value = users.value.filter((u) => u.userId !== user.user.userId && !u.userId.includes('notices'));
	});

	async function addNewPrivateRoom(other: any) {
		const me = user.user as User;
		const memberIds = [me.userId, other.userId];
		const rooms = useRooms();
		const existingRoomId = rooms.privateRoomWithMembersExist(memberIds);

		if (existingRoomId !== false) {
			await pubhubs.joinRoom(existingRoomId as string);
		} else {
			await pubhubs.createRoom({
				name: `${me.userId},${other.userId}`,
				visibility: 'private',
				invite: [other.userId],
				is_direct: true,
				creation_content: { type: PubHubsRoomType.PH_MESSAGES_DM },
				topic: `PRIVATE: ${me.userId}, ${other.userId}`,
				history_visibility: 'shared',
				guest_can_join: false,
			});
			// Returns invalid user id - 400, when no such user. So nice
		}
		close();
	}

	async function close() {
		emit('close');
	}
</script>
