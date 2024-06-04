<template>
	<div class="pl-6 pr-8 relative" @focusin="focus(true)" @click="focus(true)" @keydown.esc="focus(false)" @mouseleave="focus(false)">
		<Icon type="compass" class="absolute -ml-2 bg-white dark:bg-hub-background-2"></Icon>
		<FilteredList
			:items="usersList"
			filterKey="displayName"
			sortby="displayName"
			:placeholder="$t('rooms.private_search_user')"
			@click="addNewPrivateRoom($event)"
			@filter="filter($event)"
			:inputClass="'pl-6'"
			:listClass="'-mt-[17px] border rounded-md shadow-md'"
			:showCompleteList="showList"
		>
			<template #item="{ item }">
				<div class="flex justify-between">
					<span :title="item.userId" class="grow truncate w-100">{{ item.displayName }}</span>
					<Icon type="plus" class="flex-none"></Icon>
				</div>
			</template>
		</FilteredList>
	</div>
</template>

<script setup lang="ts">
	import { ref, onMounted, computed } from 'vue';
	import { User as MatrixUser } from 'matrix-js-sdk';
	import { useRouter } from 'vue-router';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { useUser } from '@/store/store';
	import { FilteredListEvent } from '@/types/components';

	const router = useRouter();
	const pubhubs = usePubHubs();
	const user = useUser();
	const emit = defineEmits(['close']);
	const showList = ref(false);

	const users = ref([] as Array<MatrixUser>);

	onMounted(async () => {
		users.value = await pubhubs.getUsers();
	});

	function focus(focus: boolean) {
		showList.value = focus;
	}

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
		focus(false);
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
				return arr.findIndex((item) => item.userId === user.userId) === index;
			});
		}
	}
</script>
