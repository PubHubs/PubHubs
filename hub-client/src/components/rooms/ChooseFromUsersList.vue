<template>
	<!-- factored out from AddPrivateRoom and AskDisclosure -->

	<Dialog :buttons="buttonsCancel" width="w-3/6">
		<template #header>
			{{ header }}
		</template>
		<FilteredList :items="usersList" :filterKey="['displayName']" :placeholder="$t('rooms.private_search_user')" @click="onUser($event)" @filter="filter($event)">
			<template #item="{ item }">
				<div class="flex justify-between">
					<span :title="item.userId" class="w-100 grow truncate">{{ item.displayName }}</span>
					<Icon type="plus" class="flex-none" />
				</div>
			</template>
		</FilteredList>
	</Dialog>
</template>

<script setup lang="ts">
	// Packages
	import { User as MatrixUser } from 'matrix-js-sdk';
	import { computed, onMounted, ref } from 'vue';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import Dialog from '@hub-client/components/ui/Dialog.vue';
	import FilteredList from '@hub-client/components/ui/FilteredList.vue';

	// Models
	import { FilteredListEvent } from '@hub-client/models/components/FilteredListEvent';

	// Stores
	import { buttonsCancel } from '@hub-client/stores/dialog';
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useUser } from '@hub-client/stores/user';

	const pubhubs = usePubhubsStore();
	const user = useUser();
	const emit = defineEmits(['chosenUser', 'close']);

	const props = defineProps<{
		header: string;
	}>();

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
		list = list.filter((u: any) => u.userId !== user.userId && u.rawDisplayName !== 'notices');
		return list;
	});

	async function onUser(other: any) {
		emit('chosenUser', other);
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
