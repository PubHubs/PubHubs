<template>
	<!-- When user selects a user account, show UserInRoomsForm page-->
	<UserInRoomsForm v-if="showUserInRoomForm" :administrator="currentAdministrator" :userId="selectedUserById" :displayName="selectedUserDisplayName" @close="closeUserRoomForm()" />

	<HeaderFooter>
		<template #header>
			<div class="flex h-full items-center" :class="isMobile ? 'pl-4' : 'pl-0'">
				<div class="flex w-fit items-center gap-3 overflow-hidden">
					<Icon type="users" />
					<H3 class="font-headings text-h2 text-on-surface font-semibold">{{ t('menu.admin_tools_users') }}</H3>
				</div>
			</div>
		</template>

		<div class="p-3 md:p-4">
			<!-- Reload button gets new user account if someone creates an account when this page is opened-->
			<Button class="mb-4 flex max-h-[30px] w-32 rounded-xl" @click="ManagementUtils.getUsersAccounts()">
				<div class="flex items-center gap-2 text-xl">
					<Icon type="arrow-counter-clockwise" size="sm" />
					<span class="text-label flex">{{ t('admin.reload') }}</span>
				</div>
			</Button>

			<!---List all users accounts -->
			<FilteredList :items="hubUsers" :filterKey="['displayname', 'name']" sortby="displayname" :placeholder="$t('others.filter_users')">
				<template #item="{ item }">
					<div class="hover:bg-surface-low md:gap-8p box-border flex w-full justify-between gap-4 rounded-2xl px-2 py-1 hover:cursor-pointer" :title="item.room_id" @click="selectUser(item.name, item.displayname)">
						<div class="flex min-w-0 flex-1 items-center gap-4">
							<Avatar :avatar-url="user.userAvatar(item.name)" :user-id="item.name"></Avatar>
							<p class="w-full min-w-0 truncate font-semibold">{{ item.displayname }}</p>
							<p class="text-on-surface-dim w-full min-w-0 truncate italic">{{ item.name }}</p>
							<RoomBadge v-if="!isMobile" :user="item.name" :room_id="item.room_id" :is-hub-admin="item.admin" />
						</div>
						<div class="flex w-fit gap-4">
							<div class="flex items-center gap-2">
								<Icon type="pencil-simple" class="hover:text-accent-primary hover:cursor-pointer" @click.stop="selectUser(item.name, item.displayname)" />
								<Icon v-if="item.name !== user.userId" type="lock-open" class="hover:text-accent-primary hover:cursor-pointer" @click.stop="openAskDisclosureForm(item)" />
							</div>
						</div>
					</div>
				</template>
			</FilteredList>
			<DisclosureRequestForm v-if="showAskDisclosureAttrsForm && selectedUser" :user="selectedUser" @close="closeAskDisclosureForm" />
		</div>
	</HeaderFooter>
</template>

<script setup lang="ts">
	// Packages
	import { computed, onMounted, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import UserInRoomsForm from '@hub-client/components/forms/UserInRoomsForm.vue';
	import DisclosureRequestForm from '@hub-client/components/rooms/DisclosureRequestForm.vue';
	import RoomBadge from '@hub-client/components/rooms/RoomBadge.vue';
	import Avatar from '@hub-client/components/ui/Avatar.vue';
	import FilteredList from '@hub-client/components/ui/FilteredList.vue';

	// Models
	import { ManagementUtils } from '@hub-client/models/hubmanagement/utility/managementutils';
	import { TUserAccount } from '@hub-client/models/users/TUser';

	// Stores
	import { useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	const { t } = useI18n();
	const settings = useSettings();
	const isMobile = computed(() => settings.isMobileState);
	const user = useUser();

	const hubUsers = ref<TUserAccount[]>([]);
	const selectedUserById = ref<string>();
	const selectedUserDisplayName = ref<string>();
	const showUserInRoomForm = ref(false);
	const showAskDisclosureAttrsForm = ref(false);
	const selectedUser = ref<TUserAccount | null>(null);

	// This will not be null if we are routed to this page.
	// See router.vue for manageUser page. It always has a valid admin object if user is an admin.
	const currentAdministrator = user.administrator!;

	function openAskDisclosureForm(item: TUserAccount) {
		selectedUser.value = item;
		showAskDisclosureAttrsForm.value = true;
	}

	function closeAskDisclosureForm() {
		showAskDisclosureAttrsForm.value = false;
		selectedUser.value = null;
	}

	onMounted(async () => {
		// Get all user accounts from the Hub
		hubUsers.value = await ManagementUtils.getUsersAccounts();
	});

	// Setter function for enabling UserInRoomsForm component with required props.
	// This enables the dialog box to open which users have joined which rooms.
	async function selectUser(userId: string, displayName: string) {
		showUserInRoomForm.value = true;

		selectedUserById.value = userId;

		selectedUserDisplayName.value = displayName;
	}

	//
	function closeUserRoomForm() {
		showUserInRoomForm.value = false;
	}
</script>
