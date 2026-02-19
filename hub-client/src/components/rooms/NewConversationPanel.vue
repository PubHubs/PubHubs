<template>
	<div class="flex h-full w-full flex-col overflow-hidden p-4" data-testid="sidekick">
		<SidebarHeader v-if="!groupPanel" :title="t('others.new_message')" />
		<div class="flex min-h-0 flex-1 flex-col">
			<div v-if="!groupPanel" class="flex shrink-0 flex-col gap-2">
				<div class="bg-surface-high flex items-center gap-2 rounded-md px-3 py-2">
					<Icon type="magnifying-glass" size="sm" class="text-on-surface-dim" />
					<input type="text" v-model="userFilter" :placeholder="t('others.search')" class="text-label-small placeholder:text-on-surface-variant w-full border-none bg-transparent focus:ring-0 focus:outline-0" />
				</div>
				<Button class="bg-on-surface-variant text-label-small hover:text-surface-high dark:text-surface-high flex w-full items-center justify-center gap-2" size="sm" @click="groupPanel = true">
					<Icon type="plus"></Icon> {{ t('others.new_group') }}
				</Button>
			</div>
			<div v-else class="flex flex-col gap-2">
				<div class="bg-surface-high flex items-center justify-between rounded-md px-3 py-2">
					<Icon type="arrow-left" class="cursor-pointer" @click="groupProfile ? backToGroupPanel() : (groupPanel = false)" />
					<span class="text-label-small mr-auto pl-2">
						{{ t('others.new_group') }}
					</span>
					<Icon type="x" class="cursor-pointer" @click="$emit('close')" />
				</div>
				<div class="bg-surface-high flex items-center gap-2 rounded-md px-3 py-2">
					<Icon type="magnifying-glass" size="sm" class="text-on-surface-dim" />
					<input type="text" v-model="userFilter" :placeholder="t('others.filter_users')" class="text-label-small placeholder:text-on-surface-variant w-full border-none bg-transparent focus:ring-0 focus:outline-0" />
				</div>
				<div v-if="groupProfile" class="mt-4 flex flex-col gap-2">
					<span class="text-label-small text-on-surface-dim"> {{ t('others.select_group_name') }}</span>
					<div class="bg-surface-high flex items-center gap-2 rounded-md px-3 py-2">
						<div class="bg-surface-variant h-10 w-10 cursor-pointer overflow-hidden rounded-full">
							<Avatar v-if="avatarPreviewUrl" :avatar-url="avatarPreviewUrl.url" @click="fileInput!.click()"></Avatar>
							<Button v-else color="" @click="fileInput!.click()">
								<Icon type="image-square" class="mt-025 -ml-[5px]" />
							</Button>
						</div>
						<input ref="fileInput" type="file" accept="image/*" class="hidden" @change="handleFileUpload" />

						<input type="text" v-model="groupName" class="text-label-small placeholder:text-on-surface-variant min-w-0 grow border-none bg-transparent focus:ring-0 focus:outline-0" :placeholder="t('others.select_group_name')" />
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

			<div v-if="!groupProfile" class="mt-4 grow overflow-y-auto">
				<!-- Admin contact -->
				<div v-if="!userStore.isAdmin && !groupPanel && !adminRoomExists" class="mb-4">
					<div class="hover:bg-surface-high flex cursor-pointer items-center gap-4 rounded-md p-2" @click="handleAdminContact">
						<div class="bg-accent-admin/10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
							<Icon type="lifebuoy" class="text-accent-admin" />
						</div>
						<div class="flex flex-col">
							<span class="font-bold">{{ t('admin.admin_contact_title') }}</span>
							<span class="text-on-surface-dim text-label-small">{{ t('admin.admin_contact_subtitle') }}</span>
						</div>
					</div>
				</div>

				<template v-if="Object.keys(categorizedUsers).length">
					<div v-for="(usersInLetter, letter) in categorizedUsers" :key="letter" class="mb-4">
						<h3 class="text-md text-on-surface-dim sticky top-0 z-10 py-1 font-bold uppercase">{{ letter }}</h3>
						<ul>
							<li
								v-for="user in usersInLetter"
								:key="user.userId"
								class="hover:bg-surface-high flex cursor-pointer items-center gap-2 rounded-md p-2"
								@click.once="groupPanel ? toggleUserSelection(user) : gotToPrivateRoom(user)"
							>
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
	import { computed, onBeforeUnmount, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import Avatar from '@hub-client/components/ui/Avatar.vue';
	import SidebarHeader from '@hub-client/components/ui/SidebarHeader.vue';

	// Composables
	import { fileUpload } from '@hub-client/composables/fileUpload';
	import { useDirectMessage } from '@hub-client/composables/useDirectMessage';
	import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';
	import { useSidebar } from '@hub-client/composables/useSidebar';

	// Logic
	import { BlobManager } from '@hub-client/logic/core/blobManager';
	import filters from '@hub-client/logic/core/filters';

	// Models
	import { RoomType } from '@hub-client/models/rooms/TBaseRoom';

	// Stores
	import { useDialog } from '@hub-client/stores/dialog';
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useRooms } from '@hub-client/stores/rooms';
	import { User, useUser } from '@hub-client/stores/user';

	const { t } = useI18n();
	const pubhubs = usePubhubsStore();
	const userStore = useUser();
	const rooms = useRooms();
	const dm = useDirectMessage();
	const sidebar = useSidebar();
	const groupPanel = ref<boolean>(false);
	const groupProfile = ref<boolean>(false);
	const groupPanelButton = ref<boolean>(true);
	const groupProfileButton = ref<boolean>(false);
	const fileInput = ref<HTMLInputElement | null>(null);
	const avatarPreviewUrl = ref<BlobManager>();
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

	const adminRoomExists = computed(() => rooms.fetchRoomArrayByType(RoomType.PH_MESSAGE_ADMIN_CONTACT).length > 0);

	onBeforeUnmount(() => {
		avatarPreviewUrl.value?.revoke();
	});

	const usersSelected = computed(() => pubhubs.client.getUsers().filter((user) => selectedUsers.value.includes(user.userId)));

	// New ref for the filter input
	const userFilter = ref<string>('');

	// There should be alteast 2 users to move forward with group creation.
	const selectionNotCompleted = computed(() => selectedUsers.value.length < 2 || selectedUsers.value.length >= MAX_USER_GROUP);

	// There should be a name and a dp for creating a group.
	const cannotCreateGroupRoom = computed(() => groupName.value === '' || !avatarPreviewUrl.value?.url || selectedUsers.value.length < 2);

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

	const emit = defineEmits(['close']);

	async function handleAdminContact() {
		const userResponse = await dialog.yesno(t('admin.admin_contact_title'), t('admin.admin_contact_main_msg'));
		if (!userResponse) return;

		const roomSetUpResponse = await pubhubs.setUpAdminRoom();
		if (typeof roomSetUpResponse === 'boolean' && roomSetUpResponse === false) {
			dialog.confirm(t('admin.if_admin_contact_not_present'));
			return;
		}
		if (typeof roomSetUpResponse === 'string') {
			await rooms.joinRoomListRoom(roomSetUpResponse);
			const room = rooms.rooms[roomSetUpResponse];
			if (room) {
				sidebar.openDMRoom(room);
			}
			emit('close');
		}
	}

	async function gotToPrivateRoom(other: User | MatrixUser[]) {
		const room = await dm.createDMWithUsers(other);
		if (!room) {
			dialog.confirm(t('errors.cant_find_room'));
		}
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

		if (avatarPreviewUrl.value?.url) {
			hideAvatarPreview.value = false;
		}
	}

	async function groupCreationDone(other: User | MatrixUser[]) {
		const room = await dm.createDMWithUsers(other);
		if (room) {
			await uploadAvatar(room.roomId);
			await setRoomName(room.roomId, groupName.value);
		}
	}

	const handleFileUpload = (event: Event) => {
		const file = (event.target as HTMLInputElement)?.files?.[0];
		if (file) {
			if (!supportedImageTypes.includes(file.type)) {
				dialog.confirm(t('errors.file_upload'));
				return;
			}
			avatarPreviewUrl.value?.revoke();
			avatarPreviewUrl.value = new BlobManager(file);
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
			avatarPreviewUrl.value?.revoke();
			return;
		}
	}

	async function setRoomName(roomId: string, roomName: string) {
		await pubhubs.client.setRoomName(roomId, roomName);
		pubhubs.updateRooms();
	}
</script>
