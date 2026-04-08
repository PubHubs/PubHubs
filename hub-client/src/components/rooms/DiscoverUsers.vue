<template>
	<div
		class="relative flex items-center gap-4"
		@click="focus(true)"
		@focusin="focus(true)"
		@keydown.esc="focus(false)"
		@mouseleave="focus(false)"
	>
		<FilteredList
			:filter-key="['localPart', 'displayName']"
			:items="usersList"
			:placeholder="$t('rooms.private_search_user')"
			:selected="alreadyInList || []"
			:show-complete-list="showList"
			sortby="localPart"
			@click="selectUser($event)"
			@filter="filter($event)"
		>
			<template #item="{ item }">
				<div class="hover:bg-background flex cursor-pointer items-center justify-between gap-4 rounded-md px-2 py-1">
					<span class="flex items-center gap-2 truncate"
						><span
							v-if="asUserItem(item).displayName"
							:class="`${textColor(color(asUserItem(item).userId))} text-body truncate font-semibold`"
							data-testid="display-name"
							>{{ filters.maxLengthText(asUserItem(item).displayName!, settings.getDisplayNameMaxLength) }}</span
						>
						<span
							class="text-nowrap"
							data-testid="user-id"
							>{{ asUserItem(item).localPart }}</span
						></span
					>
					<Icon
						class="flex-none"
						size="sm"
						type="plus"
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

	// Composables
	import { useUserColor } from '@hub-client/composables/useUserColor';

	// Logic
	import filters from '@hub-client/logic/core/filters';

	// Models
	import { type FilteredListEvent } from '@hub-client/models/components/FilteredListEvent';

	// Stores
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	defineProps({
		alreadyInList: {
			type: Array<MatrixUser>,
			required: false,
			default: undefined,
		},
	});
	const emit = defineEmits(['selectedUser']);
	const { color, textColor } = useUserColor();
	const settings = useSettings();
	const pubhubs = usePubhubsStore();
	const user = useUser();
	const showList = ref(false);
	const users = ref([] as Array<MatrixUser>);

	onMounted(async () => (users.value = await pubhubs.getUsers()));

	function focus(focus: boolean) {
		showList.value = focus;
	}

	type UserListItem = { userId: string; localPart: string; displayName: string | undefined };

	function asUserItem(item: Record<string, unknown>): UserListItem {
		return item as unknown as UserListItem;
	}

	const usersList = computed(() => {
		const mapped = users.value.map((u) => {
			return {
				userId: u.userId,
				localPart: localPart(u.userId),
				displayName: u.displayName,
			};
		});
		// Remove self from list
		return mapped.filter((u) => u.userId !== user.userId);
	});

	async function filter(event: FilteredListEvent) {
		const foundUsers = await pubhubs.findUsers(event.filter);
		users.value = foundUsers
			.map((u) => {
				return {
					userId: u.user_id,
					localPart: localPart(u.user_id),
					displayName: u.display_name ?? '',
				} as unknown as MatrixUser;
			})
			// The matrix search functionality only looks at starting "bits" of usernames and display names. So the hub url parts are always found. When we abstract this stuff away
			// from users we still want some consistancy so we make sure here we only show search results that match the beginning of search terms.
			// A weird edge case are display names that start with '@' or characters like emoticons. The synapse search does not return these.
			// There are issues around user search open for a while on synapse side: https://github.com/matrix-org/synapse/issues/7588, https://github.com/matrix-org/synapse/issues/7590, https://github.com/matrix-org/synapse/issues/13807
			// Linking to the archived repo so can see the comments, last comment is the migration to the new element-hq github repo. As of 24/9/2024 these issues are still open there.
			.filter(
				(u) =>
					(u as unknown as UserListItem).localPart.toLowerCase().startsWith(event.filter) ||
					((u as unknown as UserListItem).displayName ?? '').toLowerCase().startsWith(event.filter),
			);
	}

	function localPart(userId: string): string {
		if (userId.startsWith('@') && userId.indexOf(':')) {
			return userId.substring(1, userId.indexOf(':'));
		}

		//What we do in the error handling
		return '!!!-!!!';
	}

	function selectUser(event: Record<string, unknown>) {
		emit('selectedUser', event);
	}
</script>
