<template>
	<div class="absolute inset-y-0 right-0 z-40 flex h-full w-[33%] shrink-0 flex-col px-4 py-4" :class="isMobile ? 'bg-background w-full' : 'bg-surface w-[33%]'" data-testid="sidekick">
		<div class="flex h-full flex-col">
			<div v-if="!groupPanel" class="flex flex-shrink-0 flex-col">
				<div class="group flex items-center justify-between gap-4 px-8 py-2 font-bold">
					<span role="heading">{{ t('others.new_message') }}</span>
					<Icon type="x" size="md" @click="$emit('close')" class="cursor-pointer" />
				</div>
				<hr class="my-4 border-t border-white" />
				<div class="relative flex items-center px-8 py-2">
					<input type="text" v-model="userFilter" :placeholder="t('others.filter_users')" class="bg-background text-label h-8 w-full min-w-0 flex-grow rounded-lg border px-4 py-1" />
					<Icon class="absolute right-0 mr-5" type="magnifying-glass" size="sm" />
				</div>
				<div class="px-8 py-2">
					<Button class="bg-on-surface-variant text-label-small hover:text-surface-high dark:text-surface-high flex w-full items-center justify-center gap-2" size="sm" @click="groupPanel = true">
						<Icon type="plus"></Icon> {{ t('others.new_group') }}
					</Button>
				</div>
			</div>
			<div v-else class="mx-4 mt-2 flex flex-col">
				<div class="bg-surface-low flex items-center justify-between rounded-lg px-1 py-1 font-bold">
					<Icon type="arrow-left" class="cursor-pointer" @click="groupProfile ? backToGroupPanel() : (groupPanel = false)" />
					<span class="text-label-small mr-auto pl-2">
						{{ t('others.new_group') }}
					</span>
					<Icon type="x" class="cursor-pointer" @click="$emit('close')" />
				</div>
				<div class="relative flex items-center pt-2">
					<input type="text" v-model="userFilter" :placeholder="t('others.filter_users')" class="bg-background text-label h-8 w-full min-w-0 flex-grow rounded-lg border px-4 py-1" />
					<Icon class="absolute right-1" type="magnifying-glass" />
				</div>
				<div v-if="groupProfile">
					<span class="text-label-small"> {{ t('others.select_group_name') }}</span>
					<div class="bg-surface-low flex items-center gap-2 rounded-lg px-2 py-2">
						<div class="bg-surface-high h-10 w-10 cursor-pointer rounded-full">
							<Avatar v-if="avatarPreviewUrl" :avatar-url="avatarPreviewUrl" @click="fileInput!.click()"></Avatar>
							<Button v-else color="" @click="fileInput!.click()">
								<Icon type="image-square" class="mt-[2px] -ml-[5px]" />
							</Button>
						</div>
						<input ref="fileInput" type="file" accept="image/*" class="hidden" @change="handleFileUpload" />

						<input type="text" v-model="groupName" class="bg-background h-8 min-w-0 flex-grow rounded-lg border px-4 py-1" :placeholder="t('others.select_group_name')" />
					</div>
					<span class="mx-auto w-1/2"> {{ selectedUsers.length + ' ' + t('others.group_members') }} </span>
				</div>

				<span v-if="selectedUsers.length === 0" class="text-label-small mx-auto mt-4"> {{ t('others.group_select') }} </span>
				<div v-else class="mt-4 flex flex-wrap justify-start gap-y-2">
					<div v-for="user in usersSelected" :key="user.userId" class="flex flex-col items-center">
						<div class="relative">
							<Icon type="x" size="sm" class="bg-surface-subtle absolute right-0 bottom-0 cursor-pointer rounded-full" @click.stop="removeUserFromSelection(user as User)" />
							<Avatar :avatarUrl="userStore.userAvatar(user.userId)" :user-id="user.userId"></Avatar>
						</div>
						<span class="mt-1 w-16 truncate text-center text-sm">{{ user.displayName || user.userId }}</span>
					</div>
				</div>
				<Button v-if="groupPanelButton" class="bg-on-surface-variant text-surface-high hover:bg-surface-subtle mt-6 flex items-center justify-between" :disabled="selectionNotCompleted" @click="usersSelectionDone()">
					{{ t('others.next') }}
					<Icon type="arrow-right"></Icon>
				</Button>
				<Button
					v-if="groupProfileButton"
					class="bg-on-surface-variant text-surface-high text-label-small hover:bg-surface-subtle mt-12 flex justify-between"
					size="xs"
					:disabled="cannotCreateGroupRoom"
					@click="groupCreationDone(usersSelected)"
					>{{ t('others.next') }}<Icon type="arrow-right"></Icon>
				</Button>
			</div>

			<div v-if="!groupProfile" class="flex-grow overflow-y-auto px-8 py-2">
				<template v-if="Object.keys(categorizedUsers).length">
					<div v-for="(usersInLetter, letter) in categorizedUsers" :key="letter" class="mb-4">
						<h3 class="text-md text-on-surface-dim sticky top-0 z-10 py-1 font-bold uppercase">{{ letter }}</h3>
						<ul>
							<li v-for="user in usersInLetter" :key="user.userId" class="hover:bg-surface-low flex cursor-pointer items-center gap-2 py-1 pl-4" @click.once="groupPanel ? toggleUserSelection(user) : gotToPrivateRoom(user)">
								<Icon v-if="groupPanel && selectedUsers.includes(user.userId)" type="check-circle"></Icon>
								<Avatar v-else :avatarUrl="userStore.userAvatar(user.userId)" :user-id="user.userId"></Avatar>
								<div class="flex flex-col">
									<span>{{ user.displayName || user.userId }}</span>
									<span> {{ filters.extractPseudonym(user.userId) }}</span>
								</div>
							</li>
						</ul>
					</div>
				</template>
				<template v-else>
					<div class="text-on-surface-dim py-4 text-center">{{ t('others.join_room_to_dm') }}</div>
				</template>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { User as MatrixUser } from 'matrix-js-sdk';
	import { computed, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import Avatar from '@hub-client/components/ui/Avatar.vue';

	// Composables
	import { fileUpload } from '@hub-client/composables/fileUpload';
	import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';

	// Logic
	import filters from '@hub-client/logic/core/filters';

	// Stores
	import { useDialog } from '@hub-client/stores/dialog';
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { User, useUser } from '@hub-client/stores/user';

	const { t } = useI18n();
	const pubhubs = usePubhubsStore();
	const userStore = useUser();
	const groupPanel = ref<boolean>(false);
	const groupProfile = ref<boolean>(false);
	const groupPanelButton = ref<boolean>(true);
	const groupProfileButton = ref<boolean>(false);
	const fileInput = ref<HTMLInputElement | null>(null);
	const avatarPreviewUrl = ref<string | null>(null);
	const selectedAvatarFile = ref<File | null>(null);
	const hideAvatarPreview = ref<boolean>(true);
	const dialog = useDialog();
	const supportedImageTypes = ['image/png', 'image/jpeg', 'image/gif'];
	const { uploadUrl } = useMatrixFiles();
	const groupName = ref<string>('');
	const selectedUsers = ref<string[]>([]);
	const MAX_USER_GROUP = 5;

	const props = defineProps({
		isMobile: {
			type: Boolean,
			default: false,
		},
	});

	const usersSelected = computed(() => pubhubs.client.getUsers().filter((user) => selectedUsers.value.includes(user.userId)));

	// New ref for the filter input
	const userFilter = ref<string>('');

	// There should be alteast 2 users to move forward with group creation.
	const selectionNotCompleted = computed(() => selectedUsers.value.length < 2 || selectedUsers.value.length >= MAX_USER_GROUP);

	// There should be a name and a dp for creating a group.
	const cannotCreateGroupRoom = computed(() => groupName.value === '' || avatarPreviewUrl.value === null || selectedUsers.value.length < 2);

	// Categorize users based on first letter and apply filter
	const categorizedUsers = computed(() => {
		const categories: { [key: string]: User[] } = {};

		// Get the base users and filter them
		const baseUsers =
			pubhubs.client
				.getUsers()
				.filter((otherUser) => otherUser.userId !== userStore.userId && !otherUser.userId.includes('notices_user'))
				.filter((u) => {
					const displayName = u.displayName?.toLowerCase() || u.userId.toLowerCase();
					const filterText = userFilter.value.toLowerCase();
					return displayName.includes(filterText);
				}) ?? [];

		// Sort users alphabetically by display name
		const sortedUsers = [...baseUsers].sort((a, b) => {
			const nameA = a.displayName?.toUpperCase() || '';
			const nameB = b.displayName?.toUpperCase() || '';
			if (nameA < nameB) return -1;
			if (nameA > nameB) return 1;
			return 0;
		});

		sortedUsers.forEach((user) => {
			const firstLetter = user.displayName ? user.displayName.charAt(0).toUpperCase() : '#';
			if (!categories[firstLetter]) {
				categories[firstLetter] = [];
			}
			categories[firstLetter].push(user as User);
		});

		return categories;
	});

	async function gotToPrivateRoom(other: User | MatrixUser[]) {
		const room = await pubhubs.createPrivateRoomWith(other);
		if (room) await pubhubs.routeToRoomPage(room);
		else dialog.confirm(t('errors.cant_find_room'));
	}

	async function usersSelectionDone() {
		groupPanelButton.value = false;
		groupProfileButton.value = true;

		groupProfile.value = true;
		hideAvatarPreview.value = true;
	}

	function toggleUserSelection(user: User) {
		if (groupPanel.value) {
			const index = selectedUsers.value.indexOf(user.userId); // Check for userId
			if (index > -1) {
				selectedUsers.value.splice(index, 1);
			} else {
				selectedUsers.value.push(user.userId); // Push userId
			}
		}
	}

	function removeUserFromSelection(userToRemove: User) {
		selectedUsers.value = selectedUsers.value.filter((userId) => userId !== userToRemove.userId);
	}

	function backToGroupPanel() {
		groupPanel.value = true;
		groupProfile.value = false;

		groupPanelButton.value = true;
		groupProfileButton.value = false;

		if (avatarPreviewUrl.value) {
			hideAvatarPreview.value = false;
		}
	}

	async function groupCreationDone(other: User | MatrixUser[]) {
		// Should not create if selection is still not completed

		const room = await pubhubs.createPrivateRoomWith(other);
		if (room) {
			await uploadAvatar(room.room_id);
			await setRoomName(room.room_id, groupName.value);
			await pubhubs.routeToRoomPage(room);
		}
	}

	const handleFileUpload = (event: Event) => {
		const file = (event.target as HTMLInputElement)?.files?.[0];
		if (file) {
			if (!supportedImageTypes.includes(file.type)) {
				dialog.confirm(t('errors.file_upload'));
				return;
			}
			avatarPreviewUrl.value = URL.createObjectURL(file);
			selectedAvatarFile.value = file;
		}
	};

	async function uploadAvatar(roomId: string) {
		const accessToken = pubhubs.Auth.getAccessToken();
		if (!accessToken) return console.error('Access Token is invalid for File upload.');

		const syntheticEvent = {
			currentTarget: {
				files: [selectedAvatarFile.value],
			},
		} as unknown as Event;

		const errorMsg = t('errors.file_upload');

		try {
			fileUpload(errorMsg, accessToken, uploadUrl, supportedImageTypes, syntheticEvent, async (mxUrl) => {
				mxUrl && (await pubhubs.setRoomAvatar(roomId, mxUrl));
			});
		} catch (error) {
			console.error('Error uploading avatar:', error);
			avatarPreviewUrl.value === undefined;
			return;
		}
	}

	async function setRoomName(roomId: string, roomName: string) {
		await pubhubs.client.setRoomName(roomId, roomName);
		pubhubs.updateRooms();
	}
</script>
