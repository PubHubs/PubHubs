<template>
	<Dialog :buttons="buttonsCancel" width="w-3/6" @close="close()">
		<template #header>
			{{ $t('rooms.private_add') }}
		</template>
		<FilteredList :items="usersList" filterKey="displayName" :placeholder="$t('rooms.private_search_user')" @click="addNewPrivateRoom($event)" @filter="filter($event)">
			<template #item="{ item }">
				<span :title="item.userId">{{ item.displayName }}</span>
				<Icon type="plus" class="float-right"></Icon>
			</template>
		</FilteredList>
	</Dialog>
</template>

<script setup lang="ts">
	import { ref, onMounted, computed } from 'vue';
	import { User as MatrixUser } from 'matrix-js-sdk';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { User, useUser, PubHubsRoomType, useRooms } from '@/store/store';
	import { buttonsCancel } from '@/store/dialog';
	import { FilteredListEvent } from '@/types/components';

	const pubhubs = usePubHubs();
	const user = useUser();
	const emit = defineEmits(['close']);

	const users = ref([] as Array<MatrixUser>);

	onMounted(async () => {
		users.value = await pubhubs.getUsers();
	});

	const usersList = computed(() => {
		let list = users.value as any;
		list = list.map((user: any) => {
			return {
				userId: user.userId,
				displayName: user.displayName,
				avatarUrl: user.avatarUrl,
			};
		});
		// Remove self from list
		list = list.filter((u: any) => u.userId !== user.user.userId && u.rawDisplayName !== 'notices');
		return list;
	});

	async function addNewPrivateRoom(other: any) {
		const me = user.user as User;
		const memberIds = [me.userId, other.userId];
		const rooms = useRooms();
		let existingRoomId = rooms.privateRoomWithMembersExist(memberIds);

		console.log('addNewPrivateRoom existing?', existingRoomId);

		// Try joining existing
		if (existingRoomId !== false) {
			try {
				await pubhubs.joinRoom(existingRoomId as string);
			} catch (error) {
				existingRoomId = false;
			}
		}

		// If realy not exists, create new
		if (existingRoomId == false) {
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

	async function filter(event: FilteredListEvent) {
		if (event.length < 10) {
			let foundUsers = await pubhubs.findUsers(event.filter);
			foundUsers = foundUsers.map((user) => {
				user.userId = user.user_id;
				user.displayName = user.display_name;
				user.avatarUrl = user.avatar_url;
				return user;
			});
			// combine and unique
			users.value = [...users.value, ...foundUsers];
			users.value = users.value.filter((user, index, arr) => {
				return arr.findIndex((item) => item.userId == user.userId) == index;
			});
		}
	}
</script>
