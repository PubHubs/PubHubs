<template>
	<div class="bg-surface-high absolute z-50 h-[400px] overflow-auto p-2">
		<FilteredList
			:filter-key="['displayName']"
			:items="usersList"
			:placeholder="$t('rooms.private_search_user')"
			:sortby="''"
			@click="onUser($event)"
			@filter="filter($event)"
		>
			<template #item="{ item }">
				<div class="hover:bg-surface-low flex items-center justify-between gap-x-2 p-1">
					<Avatar
						:avatar-url="user.userAvatar(asString(item.userId))"
						:user-id="asString(item.userId)"
					/>
					<span
						class="w-100 grow truncate"
						:title="asString(item.userId)"
						>{{ item.displayName }}</span
					>
					<Icon
						class="flex-none"
						type="plus-square"
					/>
				</div>
			</template>
		</FilteredList>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { type User as MatrixUser } from 'matrix-js-sdk';
	import { computed, onMounted, ref } from 'vue';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import FilteredList from '@hub-client/components/ui/FilteredList.vue';

	// Models
	import { type FilteredListEvent } from '@hub-client/models/components/FilteredListEvent';
	import { notice } from '@hub-client/models/constants';

	// Stores
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useUser } from '@hub-client/stores/user';

	defineProps<{
		header: string;
	}>();
	const emit = defineEmits(['chosenUser', 'close']);
	const pubhubs = usePubhubsStore();
	const user = useUser();
	const users = ref([] as Array<MatrixUser>);

	onMounted(async () => {
		users.value = (await pubhubs.getUsers()).filter((user) => user.displayName !== notice.NoticesUser);
	});

	const usersList = computed(() => {
		const mapped = users.value.map((u) => {
			return {
				userId: u.userId,
				displayName: u.displayName,
				avatarUrl: u.avatarUrl,
			};
		});
		// Remove self from list
		return mapped.filter((u) => u.userId !== user.userId);
	});

	function asString(value: unknown): string {
		return (value as string) ?? '';
	}

	async function onUser(other: Record<string, unknown>) {
		emit('chosenUser', other);
	}

	async function filter(event: FilteredListEvent) {
		if (event.length < 10) {
			const foundUsers = (await pubhubs.findUsers(event.filter)).map((u) => {
				return {
					userId: u.user_id,
					displayName: u.display_name,
					avatarUrl: u.avatar_url,
				} as unknown as MatrixUser;
			});
			// combine and unique
			users.value = [...users.value, ...foundUsers];
			users.value = users.value.filter((user, index, arr) => {
				return arr.findIndex((item) => item.userId === user.userId) === index;
			});
		}
	}
</script>
