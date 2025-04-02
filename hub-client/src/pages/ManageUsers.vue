<template>
	<!-- When user selects a user account, show UserInRoomsForm page-->
	<UserInRoomsForm v-if="showUserInRoomForm" :administrator="currentAdministrator" :userId="selectedUserById" :displayName="selectedUserDisplayName" :avatarUrl="selectedUserAvatarUrl" @close="closeUserRoomForm()" />

	<HeaderFooter bgBarLow="bg-background" bgBarMedium="bg-surface-low">
		<template #header>
			<div class="hidden items-center gap-4 text-on-surface-dim md:flex">
				<span class="font-semibold uppercase">{{ t('admin.title_administrator') }}</span>
				<hr class="h-[2px] grow bg-on-surface-dim" />
			</div>
			<div class="flex h-full items-center pl-12 md:pl-0">
				<H3 class="font-body font-bold text-on-surface">{{ t('menu.admin_tools_users') }}</H3>
			</div>
		</template>

		<div class="p-3 md:p-4">
			<!-- Reload button gets new user account if someone creates an account when this page is opened-->
			<Button class="mb-4 flex max-h-[30px] w-32 rounded-xl" @click="ManagementUtils.getUsersAccounts()">
				<div class="flex items-center gap-2 text-xl">
					<Icon type="refresh" size="sm" />
					<span class="flex ~text-label-min/label-max">{{ t('admin.reload') }}</span>
				</div>
			</Button>

			<!---List all users accounts -->
			<FilteredList :items="hubUsers" :filterKey="['displayname']" sortby="displayname" :placeholder="$t('rooms.filter')">
				<template #item="{ item }">
					<div class="box-border flex w-full justify-between gap-4 md:gap-8" :title="item.room_id">
						<div class="flex min-w-0 flex-1 items-center gap-4">
							<Avatar :user="item.name" :override-avatar-url="item.avatar_url" />
							<p class="min-w-0 truncate font-semibold">{{ item.displayname }}</p>
							<p class="line-clamp-1 hidden min-w-0 pr-1 italic text-on-surface-dim md:inline">{{ item.name }}</p>
							<span v-if="item.admin" class="relative line-clamp-1 w-fit items-center rounded-md bg-accent-red px-1 font-medium text-on-accent-red ~text-label-min/label-max">Hub Administrator</span>
						</div>
						<div class="flex w-fit gap-4">
							<div class="flex items-center gap-2">
								<Icon type="edit" class="hover:text-accent-primary" @click="selectUser(item.name, item.displayname, item.avatar_url)" />
							</div>
						</div>
					</div>
				</template>
			</FilteredList>
		</div>
	</HeaderFooter>
</template>

<script setup lang="ts">
	import Avatar from '@/components/ui/Avatar.vue';

	import { onMounted, ref } from 'vue';
	import { TUserAccount } from '@/model/users/TUser';
	import { useUser } from '@/logic/store/user';
	import { ManagementUtils } from '@/model/hubmanagement/utility/managementutils';

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
