<template>
	<div v-if="groupUsers.length > 0" class="flew-row space-between flex flex-wrap gap-1 border-b-2">
		<div v-for="user in groupUsers" :key="user.userId" class="flex flex-row gap-1 rounded-lg bg-surface-high px-2 py-1">
			<span>{{ user.displayName }} </span>
			<Icon type="closingCross" size="sm" @click="removeUserFromGroup(user as User)"></Icon>
		</div>
		<Button :disabled="cannotCreateGroupRoom" @click="createGroupPrivateRoom"> create</Button>
	</div>
	<div class="relative flex w-full items-center gap-4 pl-4" @focusin="focus(true)" @click="focus(true)" @keydown.esc="focus(false)" @mouseleave="focus(false)">
		<FilteredList
			:items="usersList"
			:filterKey="['localPart', 'displayName']"
			sortby="localPart"
			:placeholder="$t('rooms.private_search_user')"
			@click="createNewPrivateRoom($event)"
			@filter="filter($event)"
			:showCompleteList="showList"
		>
			<template #item="{ item }">
				<div class="flex cursor-pointer items-center justify-between gap-4 rounded-md px-2 py-1 hover:bg-background">
					<span class="flex items-center gap-2 truncate"
						><span v-if="item.displayName" data-testid="display-name" :class="`${textColor(color(item.userId))} ~text-body-min/body-max truncate font-semibold`">{{
							filters.maxLengthText(item.displayName, settings.getDisplayNameMaxLength)
						}}</span>
						<span data-testid="user-id" class="text-nowrap">{{ item.localPart }}</span></span
					>
					<Icon type="plus" class="flex-none" size="sm" />
				</div>
			</template>
		</FilteredList>
	</div>
</template>

<script setup lang="ts">
	// Components
	import Button from '../elements/Button.vue';
	import FilteredList from '../ui/FilteredList.vue';
	import Icon from '../elements/Icon.vue';

	import { FilteredListEvent } from '@/model/components/FilteredListEvent';

	import { useUserColor } from '@/logic/composables/useUserColor';
	import filters from '@/logic/core/filters';
	import { usePubHubs } from '@/logic/core/pubhubsStore';
	import { useSettings } from '@/logic/store/settings';
	import { useDialog } from '@/logic/store/dialog';
	import { useRouter } from 'vue-router';
	import { User, useUser } from '@/logic/store/user';
	import { User as MatrixUser } from 'matrix-js-sdk';
	import { computed, onMounted, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	const { color, textColor } = useUserColor();

	const settings = useSettings();
	const router = useRouter();
	const pubhubs = usePubHubs();
	const dialog = useDialog();
	const user = useUser();
	const { t } = useI18n();

	const emit = defineEmits(['close']);
	const showList = ref(false);
	const users = ref([] as Array<MatrixUser>);
	const groupUsers = ref([] as Array<MatrixUser>);

	const MAX_USER_GROUP = 5;

	onMounted(async () => (users.value = await pubhubs.getUsers()));

	// There should be alteast 2 other users and maximum of 5
	const cannotCreateGroupRoom = computed(() => groupUsers.value.length < 2 || groupUsers.value.length >= MAX_USER_GROUP);

	const props = defineProps<{ group?: Boolean }>();

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

	function add(user: User): void {
		// Check if a user with the same id already exists
		const isDuplicate = groupUsers.value.some((existingUser) => existingUser.userId === user.userId);

		if (!isDuplicate) {
			groupUsers.value.push(user);
		}

		if (groupUsers.value.length >= MAX_USER_GROUP) {
			dialog.confirm(t('rooms.group_limit'));
			return;
		}
	}

	async function createNewPrivateRoom(other: User): Promise<void> {
		// Only populate group Users set in case of Group room.
		if (props.group) {
			add(other);
		} else {
			createPrivateRoom(other);
		}
		await close();
	}

	// Remove the user before creating the room.
	async function removeUserFromGroup(user: User): Promise<void> {
		groupUsers.value = groupUsers.value.filter((selectedUser) => selectedUser.userId !== user.userId);
	}

	async function routeToRoomPage(room: { room_id: string }) {
		const room_id = room.room_id;
		await router.push({ name: 'room', params: { id: room_id } });
	}

	async function createPrivateRoom(other: User | MatrixUser[]) {
		const room = await pubhubs.createPrivateRoomWith(other);
		room && (await routeToRoomPage(room));
	}

	async function createGroupPrivateRoom(): Promise<void> {
		groupUsers.value.forEach((element) => console.debug(element));
		const room = await pubhubs.createPrivateRoomWith(groupUsers.value as Array<MatrixUser>);
		groupUsers.value = [];
		room && (await routeToRoomPage(room));
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
