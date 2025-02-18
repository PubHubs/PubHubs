<template>
	<!-- When user selects a user account, show UserInRoomsForm page-->
	<UserInRoomsForm v-if="showUserInRoomForm" :administrator="currentAdministrator" :userId="selectedUserById" :displayName="selectedUserDisplayName" :avatarUrl="selectedUserAvatarUrl" @close="closeUserRoomForm()"></UserInRoomsForm>

	<HeaderFooter>
		<template #header>
			<div class="pl-20 md:p-4">
				<H1>{{ t('menu.admin_tools_users') }}</H1>
				<p class="text-sm">{{ t('admin.manage_user_description') }}</p>
			</div>

			<!-- Reload button gets new user account if someone creates an account when this page is opened-->
			<Button class="mb-4 flex max-h-[30px] w-32 rounded-xl" @click="ManagementUtils.getUsersAccounts()">
				<div class="flex items-center gap-2 text-xl">
					<Icon type="refresh" size="sm"></Icon>
					<span class="hidden text-sm md:flex">{{ t('admin.reload') }}</span>
				</div>
			</Button>

			<!---List all users accounts -->

			<FilteredList class="h-0" :items="hubUsers" :filterKey="['displayname']" sortby="displayname" :placeholder="$t('rooms.filter')">
				<template #item="{ item }">
					<div class="flex w-full justify-between gap-8" :title="item.room_id">
						<div class="flex w-full items-center gap-4">
							<Avatar :user="item.name" :override-avatar-url="item.avatar_url"></Avatar>
							<p class="truncate">{{ item.displayname }}</p>
							<p class="hidden truncate pr-1 italic text-gray-light md:inline">{{ item.name }}</p>
							<span v-if="item.admin" class="relative items-center rounded-md bg-avatar-red px-1 text-sm font-medium text-white">Hub Administrator</span>
						</div>
						<div class="flex w-fit gap-4">
							<div class="flex items-center gap-2">
								<Icon type="edit" class="hover:stroke-hub-accent" @click="selectUser(item.name, item.displayname, item.avatar_url)"></Icon>
							</div>
						</div>
					</div>
				</template>
			</FilteredList>
		</template>
	</HeaderFooter>
</template>

<script setup lang="ts">
	import { onMounted, ref } from 'vue';

	import { TUserAccount } from '@/model/users/TUser';

	import Avatar from '@/components/ui/Avatar.vue';

	import { useUser } from '@/store/user';

	import { ManagementUtils } from '@/hubmanagement/utility/managementutils';

	import { useI18n } from 'vue-i18n';

	const { t } = useI18n();

	// Store
	const user = useUser();

	// Refs
	const hubUsers = ref<TUserAccount[]>([]);

	const selectedUserById = ref<string>();

	const selectedUserDisplayName = ref<string>();

	const showUserInRoomForm = ref(false);

	const selectedUserAvatarUrl = ref<string>();

	// This will not be null if we are routed to this page.
	// See router.vue for manageUser page. It always has a valid admin object if user is an admin.
	const currentAdministrator = user.administrator!;

	onMounted(async () => {
		// Get All user accounts from the Hub
		hubUsers.value = await ManagementUtils.getUsersAccounts();
		console.debug(hubUsers.value);
	});

	// Display related information

	// Setter function for enabling UserInRoomsForm component with required props.
	// This enables the dialog box to open which users have joined which rooms.
	async function selectUser(userId: string, displayName: string, avatarUrl: string) {
		showUserInRoomForm.value = true;

		selectedUserById.value = userId;

		selectedUserDisplayName.value = displayName;

		selectedUserAvatarUrl.value = avatarUrl;
	}

	//
	function closeUserRoomForm() {
		showUserInRoomForm.value = false;
	}
</script>
