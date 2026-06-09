<template>
	<div
		class="relative flex h-full w-full flex-col overflow-hidden py-4"
		data-testid="sidekick"
	>
		<SidebarHeader :title="groupPanel ? t('others.new_group') : t('others.new_message')" />
		<div class="flex min-h-0 flex-1 flex-col">
			<div
				v-if="!groupPanel"
				class="flex shrink-0 flex-col gap-2 px-4"
			>
				<div class="bg-surface-sunken flex items-center gap-2 rounded-md px-3 py-2">
					<Icon
						class="text-on-surface-dim"
						size="sm"
						type="magnifying-glass"
					/>
					<input
						v-model="userFilter"
						class="text-label-small placeholder:text-on-surface-dim w-full border-none bg-transparent focus:ring-0 focus:outline-0"
						:placeholder="t('others.search_users')"
						type="text"
					/>
				</div>
			</div>
			<div
				v-else
				class="flex flex-col gap-2 px-4"
			>
				<button
					class="text-on-surface-dim hover:bg-surface-base border-on-surface-disabled/25 -mx-4 flex items-center gap-2 border-y-2 px-4 py-3 transition-colors hover:cursor-pointer"
					type="button"
					@click="groupProfile ? backToGroupPanel() : (groupPanel = false)"
				>
					<Icon
						size="sm"
						type="caret-left"
					/>
					<span class="text-body-small">{{ t('dialog.back') }}</span>
				</button>

				<div class="bg-surface-sunken mt-2 flex items-center gap-2 rounded-md px-3 py-2">
					<Icon
						class="text-on-surface-dim"
						size="sm"
						type="magnifying-glass"
					/>
					<input
						v-model="userFilter"
						class="text-label-small placeholder:text-on-surface-dim w-full border-none bg-transparent focus:ring-0 focus:outline-0"
						:placeholder="t('others.search_users')"
						type="text"
					/>
				</div>
				<div
					v-if="groupProfile"
					class="mt-4 flex flex-col gap-2"
				>
					<span class="text-label-small text-on-surface-dim"> {{ t('others.select_group_name') }}</span>
					<div class="bg-surface-sunken flex items-center gap-2 rounded-md px-3 py-2">
						<div class="bg-surface-variant h-10 w-10 cursor-pointer overflow-hidden rounded-full">
							<Avatar
								v-if="avatarPreviewUrl"
								:avatar-url="avatarPreviewUrl.url"
								@click="fileInput!.click()"
							/>
							<Button
								v-else
								color=""
								@click="fileInput!.click()"
							>
								<Icon
									class="mt-025 -ml-[5px]"
									type="image-square"
								/>
							</Button>
						</div>
						<input
							ref="fileInput"
							accept="image/*"
							class="hidden"
							type="file"
							@change="handleFileUpload"
						/>

						<input
							v-model="groupName"
							class="text-label-small placeholder:text-on-surface-dim min-w-0 grow border-none bg-transparent focus:ring-0 focus:outline-0"
							:placeholder="t('others.select_group_name')"
							type="text"
						/>
					</div>
					<span class="mx-auto w-1/2"> {{ selectedUsers.length + ' ' + t('others.group_members') }} </span>
				</div>

				<span
					v-if="selectedUsers.length === 0"
					class="text-label-small mx-auto mt-4"
				>
					{{ t('others.group_select') }}
				</span>
				<div
					v-else
					class="mt-4 flex flex-wrap justify-start gap-y-2"
				>
					<div
						v-for="userId in usersSelected"
						:key="userId"
						class="flex flex-col items-center"
					>
						<div class="relative">
							<Icon
								class="bg-surface-subtle absolute right-0 bottom-0 cursor-pointer rounded-full"
								size="sm"
								type="x"
								@click.stop="removeUserFromSelection(userId)"
							/>
							<Avatar
								:avatar-url="userStore.userAvatar(userId)"
								:user-id="userId"
							/>
						</div>
						<span class="mt-1 w-16 truncate text-center text-sm">{{ userStore.userDisplayName(userId) }}</span>
					</div>
				</div>
			</div>

			<div
				v-if="!groupProfile"
				class="mt-4 grow overflow-y-auto px-4"
			>
				<!-- Admin contact -->
				<div
					v-if="!userStore.isAdmin && !groupPanel"
					class="mb-4"
				>
					<div
						class="hover:bg-surface-elevated flex cursor-pointer items-center gap-4 rounded-md p-2"
						@click="handleAdminContact"
					>
						<div class="bg-accent-admin/10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
							<Icon
								class="text-accent-admin"
								type="lifebuoy"
							/>
						</div>
						<div class="flex flex-col">
							<span class="font-bold">{{ t('admin.admin_contact_title') }}</span>
							<span class="text-on-surface-dim text-label-small">{{ t('admin.admin_contact_subtitle') }}</span>
						</div>
					</div>
				</div>

				<template v-if="categorizedUsers.length">
					<div
						v-for="[letter, usersInLetter] in categorizedUsers"
						:key="letter"
						class="mb-4"
					>
						<h3 class="text-md text-on-surface-dim sticky top-0 z-10 py-1 font-bold uppercase">
							{{ letter }}
						</h3>
						<ul>
							<li
								v-for="user in usersInLetter"
								:key="user.userId"
								class="hover:bg-surface-elevated flex cursor-pointer items-center gap-2 rounded-md p-2"
								@click="groupPanel ? toggleUserSelection(user) : gotToPrivateRoom(user.userId)"
							>
								<Icon
									v-if="groupPanel && selectedUsers.includes(user.userId)"
									type="check-circle"
								/>
								<Avatar
									v-else
									:avatar-url="userStore.userAvatar(user.userId)"
									:user-id="user.userId"
								/>
								<div class="flex flex-col">
									<span v-if="isUserDisplayNameInList(user.displayName)">{{ user.displayName }}</span>
									<span>{{ filters.extractPseudonym(user.userId) }}</span>
								</div>
							</li>
						</ul>
					</div>
				</template>
				<template v-else>
					<div class="text-on-surface-dim py-4 text-center">
						{{ t('others.join_room_to_dm') }}
					</div>
				</template>
			</div>
		</div>
		<FloatingActionButton
			v-if="!groupPanel"
			class="absolute right-4 bottom-4"
			:label="t('others.new_group')"
			icon="plus"
			@click="groupPanel = true"
		/>
		<FloatingActionButton
			v-if="groupPanel && groupPanelButton"
			class="absolute right-4 bottom-4"
			:label="t('others.next')"
			:disabled="selectionNotCompleted"
			icon="arrow-right"
			@click="usersSelectionDone()"
		/>
		<FloatingActionButton
			v-if="groupPanel && groupProfileButton"
			class="absolute right-4 bottom-4"
			:label="t('others.next')"
			:disabled="cannotCreateGroupRoom"
			icon="arrow-right"
			@click="groupCreationDone(usersSelected)"
		/>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { computed, onBeforeUnmount, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import FloatingActionButton from '@hub-client/components/elements/FloatingActionButton.vue';
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
	import { createLogger } from '@hub-client/logic/logging/Logger';

	// Stores
	import { useDialog } from '@hub-client/stores/dialog';
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useRooms } from '@hub-client/stores/rooms';
	import { type User, useUser } from '@hub-client/stores/user';

	defineProps({
		isMobile: {
			type: Boolean,
			default: false,
		},
	});
	const emit = defineEmits(['close']);
	const logger = createLogger('NewConversationPanel');
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

	onBeforeUnmount(() => {
		avatarPreviewUrl.value?.revoke();
	});

	const usersSelected = computed(() =>
		pubhubs
			.getHubUsers()
			.filter((user) => selectedUsers.value.includes(user.userId))
			.map((user) => user.userId),
	);

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
			pubhubs
				.getHubUsers()
				.filter((otherUser) => otherUser.userId !== userStore.userId && !otherUser.userId.includes('notices_user'))
				.filter((u) => {
					const displayName = u.displayName?.toLowerCase() || u.userId.toLowerCase();
					const filterText = userFilter.value.toLowerCase();
					return displayName.includes(filterText);
				}) ?? [];

		baseUsers.forEach((user) => {
			const firstLetter = user.displayName ? user.displayName.charAt(0).toUpperCase() : '#';
			if (!categories[firstLetter]) {
				categories[firstLetter] = [];
			}
			categories[firstLetter].push(user as User);
		});

		// Sort on first letter of username: A-Z, 0-9, @
		const categoryOrder = (k: string) => {
			if (k.toLowerCase() !== k.toUpperCase()) return 0; // so a-z, A-Z, but also Ä, é, ç etc.
			if (k >= '0' && k <= '9') return 1;
			return 2;
		};
		return Object.keys(categories)
			.sort((a, b) => categoryOrder(a) - categoryOrder(b) || a.localeCompare(b))
			.map((key) => [key, categories[key]!] as [string, User[]]);
	});

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

	async function gotToPrivateRoom(other: string) {
		const room = await dm.createDMWithUsers([other]);
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

	function isUserDisplayNameInList(displayName: string | undefined): boolean {
		if (!displayName) return false;
		return displayName[0].toLowerCase() !== displayName[0].toUpperCase(); // // so a-z, A-Z, but also Ä, é, ç etc.
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

	function removeUserFromSelection(userIdToRemove: string) {
		selectedUsers.value = selectedUsers.value.filter((userId) => userId !== userIdToRemove);
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

	async function groupCreationDone(other: string[]) {
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
		if (!accessToken) return logger.error('Access Token is invalid for File upload.');

		const syntheticEvent = {
			currentTarget: {
				files: [selectedAvatarFile.value],
			},
		} as unknown as Event;

		const errorMsg = t('errors.file_upload');

		try {
			fileUpload(errorMsg, accessToken, uploadUrl, supportedImageTypes, syntheticEvent, async (mxUrl) => {
				if (mxUrl) {
					await pubhubs.setRoomAvatar(roomId, mxUrl);
				}
			});
		} catch (error) {
			logger.error('Error uploading avatar:', error);
			avatarPreviewUrl.value?.revoke();
			return;
		}
	}

	async function setRoomName(roomId: string, roomName: string) {
		await pubhubs.client.setRoomName(roomId, roomName);
		rooms.setRoomListName(roomId, roomName);
	}
</script>
