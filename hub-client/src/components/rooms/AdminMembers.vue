<template>
	<div class="absolute inset-0 z-20 h-full bg-gray-middle opacity-75"></div>
	<div class="border-b-1 border-x-1 absolute top-40 z-30 m-auto w-1/2 rounded-md bg-hub-background-2 p-8 dark:text-white-middle">
		<div class="flex justify-between">
			<h2 class="light:text-black mx-2 my-2 mt-4 text-lg font-bold theme-light:text-black">Room Join</h2>
			<Icon type="close" size="md" class="mt-4 hover:text-red theme-light:text-gray theme-light:hover:text-red" @click="$emit('close')"></Icon>
		</div>
		<hr class="mx-8 mb-4 mt-2 border-gray-lighter" />
		<div class="bg-blue-middle flex justify-center rounded-md bg-blue-light text-white-middle">
			<Icon type="exclamation" class="inline"></Icon>
			<span>{{ t('admin.join_warning') }}</span>
		</div>
		<div>
			<table class="w-full text-left text-lg text-gray-darker dark:text-white rtl:text-right">
				<thead class="text-md">
					<tr>
						<th scope="col" class="w-8 px-6 py-3"></th>
						<th scope="col" class="py-3"></th>
						<th scope="col" class="px-6 py-3"></th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="adminId in adminMembersId" :key="adminId">
						<td class="px-6 py-4"><Avatar :user="getMatrixUser(adminId)" :overrideAvatarUrl="updateAuthenticatedUrlMap.get(adminId)" class="h-10 w-10"></Avatar></td>

						<td class="px-6 py-4">
							<span class="font-semibold text-gray-dark">{{ adminId }}</span>
						</td>
						<td>
							<button @click="forceRejoinFlow(adminId)" class="ml-4 rounded bg-blue px-3 py-1 text-white transition hover:bg-blue-dark">{{ $t('admin.join') }}</button>
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>
</template>
<script setup lang="ts">
	import { APIService } from '@/hubmanagement/services/apiService';

	import { onMounted, watch, ref } from 'vue';

	import { UserAccount } from '@/hubmanagement/types/userAccount';

	import { AccessToken } from '@/hubmanagement/types/authType';

	import { useDialog } from '@/store/dialog';

	import { usePubHubs } from '@/core/pubhubsStore';

	import { useI18n } from 'vue-i18n';

	import { useUser } from '@/store/user';

	import { User as MatrixUser } from 'matrix-js-sdk';

	import { ManagementUtils } from '@/hubmanagement/utility/managementutils';

	import Avatar from '../ui/Avatar.vue';

	const { t } = useI18n();

	const adminMembersId = ref<string[]>([]);

	// Map is used to store <admin id, authenticated media url>
	const updateAuthenticatedUrlMap = ref<Map<string, string>>(new Map());

	const dialog = useDialog();

	const user = useUser();

	const emit = defineEmits(['close']);

	const pubhubs = usePubHubs();

	const props = defineProps({
		roomId: {
			type: String,
			required: true,
		},
	});

	onMounted(async () => {
		adminMembersId.value = await ManagementUtils.getAdminUsersId(props.roomId);

		// New code to populate the updateAuthenticatedUrlMap
		for (const id of adminMembersId.value) {
			let url = await getAuthorizedAvatarUrl(id);

			if (url !== null) updateAuthenticatedUrlMap.value.set(id, url);
		}
	});

	watch(
		() => props.roomId,
		async () => {
			// For new room, we will have new admin Ids .
			updateAuthenticatedUrlMap.value.clear();

			//Fetch all admin ids in the room.
			adminMembersId.value = await ManagementUtils.getAdminUsersId(props.roomId);

			for (const id of adminMembersId.value) {
				// Get authenticated avatar url for the ids.
				let url = await getAuthorizedAvatarUrl(id);

				// Store it in a map
				if (url !== null) updateAuthenticatedUrlMap.value.set(id, url);
			}
		},
	);

	function getMatrixUser(userId: string): MatrixUser {
		return pubhubs.client.getUser(userId)!;
	}
	async function getAuthorizedAvatarUrl(userId: string) {
		const userAccount: UserAccount = await APIService.adminQueryAccount(userId);

		return userAccount.avatar_url && (await pubhubs.getAuthorizedMediaUrl(userAccount.avatar_url));
	}

	// Flow to trigger force join and make 'this user admin' as the admin of the room.
	async function forceRejoinFlow(pastAdminUserId: string) {
		let joinState;
		try {
			// Member is not in the room, then prompt for join room message and then join flow begins.
			joinState = await promptAndAttemptToJoin(pastAdminUserId);
			joinState && (await promptAndMakeAdmin(props.roomId));
		} catch (error: any) {
			dialog.showError(error as string);
		}
		emit('close');
	}

	async function promptAndAttemptToJoin(pastAdminUserId: string): Promise<number> {
		const joinRoomState = await dialog.yesno(t('admin.msg_prev_admin_join'));

		if (joinRoomState) {
			// Past admin join
			const accessToken: AccessToken = await APIService.adminUserLogin(pastAdminUserId);
			await APIService.forceRoomJoin(props.roomId, accessToken.access_token);
			// This admin joins the room as well.
			await pubhubs.client.joinRoom(props.roomId);
		}
		return joinRoomState as number;
	}

	async function promptAndMakeAdmin(roomId: string): Promise<void> {
		const confirmState = await dialog.confirm(t('admin.msg_make_admin'));
		confirmState && (await APIService.makeRoomAdmin(roomId, user.user.userId));
	}
</script>
