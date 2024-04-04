<template>
	<Dialog :buttons="buttonsCancel" width="lg:w-3/6 md:5/6 xs:w-full" @close="close()">
		<template #header>
			{{ $t('rooms.private_add') }}
		</template>
		<FilteredList :items="usersList" filterKey="displayName" sortby="displayName" :placeholder="$t('rooms.private_search_user')" @click="addNewPrivateRoom($event)" @filter="filter($event)">
			<template #item="{ item }">
				<div class="flex justify-between">
					<span :title="item.userId" class="grow truncate w-100">{{ item.displayName }}</span>
					<Icon type="plus" class="flex-none"></Icon>
				</div>
			</template>
		</FilteredList>
	</Dialog>
</template>

<script setup lang="ts">
	import { ref, onMounted, computed } from 'vue';
	import { User as MatrixUser } from 'matrix-js-sdk';
	import { useRouter } from 'vue-router';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { useUser } from '@/store/store';
	import { buttonsCancel } from '@/store/dialog';
	import { FilteredListEvent } from '@/types/components';

	const router = useRouter();
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
		const room = await pubhubs.createPrivateRoomWith(other);
		if (room) {
			const room_id = room.room_id;
			close();
			await router.push({ name: 'room', params: { id: room_id } });
		} else {
			close();
		}
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
