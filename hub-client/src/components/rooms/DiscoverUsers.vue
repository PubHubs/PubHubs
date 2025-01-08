<template>
	<div class="pl-6 pr-8 relative" @focusin="focus(true)" @click="focus(true)" @keydown.esc="focus(false)" @mouseleave="focus(false)">
		<Icon type="compass" class="absolute -ml-2 bg-white dark:bg-hub-background-2"></Icon>
		<FilteredList
			:items="usersList"
			:filterKey="['localPart', 'displayName']"
			sortby="localPart"
			:placeholder="$t('rooms.private_search_user')"
			@click="addNewPrivateRoom($event)"
			@filter="filter($event)"
			:inputClass="'pl-6'"
			:listClass="'-mt-[17px] border rounded-md shadow-md'"
			:showCompleteList="showList"
		>
			<template #item="{ item }">
				<div class="flex justify-between items-center gap-2">
					<span data-testid="user-id" class="text-xs font-normal text-nowrap">{{ item.localPart }}</span>
					<span v-if="item.displayName" data-testid="display-name" :class="`${textColor(color(item.userId))} font-semibold text-sm truncate`">{{ filters.maxLengthText(item.displayName, settings.getDisplayNameMaxLength) }}</span>
					<Icon type="plus" class="flex-none"></Icon>
				</div>
			</template>
		</FilteredList>
	</div>
</template>

<script setup lang="ts">
	// Components
	import FilteredList from '../ui/FilteredList.vue';
	import Icon from '../elements/Icon.vue';

	import { useUserColor } from '@/composables/useUserColor';
	import filters from '@/core/filters';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { useSettings } from '@/store/settings';
	import { useUser } from '@/store/user';
	import { FilteredListEvent } from '@/types/components';
	import { User as MatrixUser } from 'matrix-js-sdk';
	import { computed, onMounted, ref } from 'vue';
	import { useRouter } from 'vue-router';

	const { color, textColor } = useUserColor();
	const settings = useSettings();
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
				localPart: localPart(user.userId),
				displayName: user.displayName,
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
		let foundUsers = await pubhubs.findUsers(event.filter);
		users.value = foundUsers
			.map((user) => {
				user.userId = user.user_id;
				user.localPart = localPart(user.user_id);
				user.displayName = user.display_name;
				return user;
			})
			// The matrix search functionality only looks at starting "bits" of usernames and display names. So the hub url parts are always found. When we abstract this stuff away
			// from users we still want some consistancy so we make sure here we only show search results that match the beginning of search terms.
			// A weird edge case are display names that start with '@' or characters like emoticons. The synapse search does not return these.
			// There are issues around user search open for a while on synapse side: https://github.com/matrix-org/synapse/issues/7588, https://github.com/matrix-org/synapse/issues/7590, https://github.com/matrix-org/synapse/issues/13807
			// Linking to the archived repo so can see the comments, last comment is the migration to the new element-hq github repo. As of 24/9/2024 these issues are still open there.
			.filter((u) => u.localPart.toLowerCase().startsWith(event.filter) || u.displayName.toLowerCase().startsWith(event.filter));
	}

	function localPart(userId: string): string {
		if (userId.startsWith('@') && userId.indexOf(':')) {
			return userId.substring(1, userId.indexOf(':'));
		}

		//What we do in the error handling
		return '!!!-!!!';
	}
</script>
