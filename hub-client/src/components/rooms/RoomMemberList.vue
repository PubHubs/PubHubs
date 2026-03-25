<template>
	<div class="flex h-full flex-col overflow-y-hidden py-4">
		<SidebarHeader :title="$t('rooms.members')" />
		<div class="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
			<!-- Contact steward card -->
			<div class="hover:bg-surface-high flex cursor-pointer items-center gap-4 rounded-md p-2" @click="contactSteward">
				<div class="bg-accent-steward/10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
					<Icon type="lifebuoy" size="md" class="text-accent-steward" />
				</div>
				<div class="flex flex-col">
					<span class="font-bold">{{ t('rooms.contact_steward_title') }}</span>
					<span class="text-on-surface-dim text-label-small">{{ t('rooms.contact_steward_subtitle') }}</span>
				</div>
			</div>

			<div v-if="stewardList && stewardList.length > 0" class="pb-4">
				<CollapsibleHeader :label="$t('rooms.stewards')">
					<template #right>
						<div class="flex items-center gap-1">
							<div>{{ stewardList.length }}</div>
							<Icon type="user"></Icon>
						</div>
					</template>
					<div
						v-for="steward in stewardList"
						:key="steward.userId"
						class="flex w-full items-center gap-2 rounded-md p-2"
						:class="contextMenuStore.isOpen && contextMenuStore.currentTargetId === steward.userId && 'bg-surface-low'"
						v-context-menu="steward.userId !== user.user?.userId && !props.disableDM ? (evt: any) => openMenu(evt, getUserContextMenuItems(steward.userId), steward.userId) : undefined"
					>
						<Avatar :avatar-url="user.userAvatar(steward.userId)" :userId="steward.userId" :enableDM="false" class="h-8 w-8 shrink-0"></Avatar>
						<UserDisplayName :userId="steward.userId" :user-display-name="user.userDisplayName(steward.userId)" :enableDM="false"></UserDisplayName>
					</div>
				</CollapsibleHeader>
			</div>

			<div v-if="memberIds && memberIds.length > 0" class="grow">
				<CollapsibleHeader :label="$t('rooms.members')">
					<template #right>
						<div class="flex items-center gap-1">
							<div>{{ memberIds.length }}</div>
							<Icon type="user"></Icon>
						</div>
					</template>
					<div
						v-for="memberId in memberIds"
						:key="memberId"
						class="flex w-full items-center gap-2 rounded-md p-2"
						:class="contextMenuStore.isOpen && contextMenuStore.currentTargetId === memberId && 'bg-surface-low'"
						v-context-menu="memberId !== user.user?.userId && !props.disableDM ? (evt: any) => openMenu(evt, getUserContextMenuItems(memberId), memberId) : undefined"
					>
						<Avatar :avatar-url="user.userAvatar(memberId)" :userId="memberId" :enableDM="false" class="h-8 w-8 shrink-0"></Avatar>
						<UserDisplayName :userId="memberId" :user-display-name="user.userDisplayName(memberId)" :enableDM="false"></UserDisplayName>
					</div>
				</CollapsibleHeader>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import UserDisplayName from '@hub-client/components/rooms/UserDisplayName.vue';
	import Avatar from '@hub-client/components/ui/Avatar.vue';
	import CollapsibleHeader from '@hub-client/components/ui/CollapsibleHeader.vue';
	import SidebarHeader from '@hub-client/components/ui/SidebarHeader.vue';

	// Composables
	import { useAdminDashboard } from '@hub-client/composables/dashboard/admin.composable';
	import { useDirectMessage } from '@hub-client/composables/useDirectMessage';
	import { useSidebar } from '@hub-client/composables/useSidebar';

	// Models
	import Room from '@hub-client/models/rooms/Room';
	import { UserPowerLevel } from '@hub-client/models/users/TUser';

	// Store
	import { useMessageActions } from '@hub-client/stores/message-actions';
	import { useRooms } from '@hub-client/stores/rooms';
	import { useUser } from '@hub-client/stores/user';

	// New design
	import { useContextMenu } from '@hub-client/new-design/composables/contextMenu.composable';
	import { useContextMenuStore } from '@hub-client/new-design/stores/contextMenu.store';

	const { t } = useI18n();
	const user = useUser();
	const rooms = useRooms();
	const dm = useDirectMessage();
	const messageActions = useMessageActions();
	const sidebar = useSidebar();
	const { openMenu } = useContextMenu();
	const contextMenuStore = useContextMenuStore();

	const { stewardList, getStewardsInRoom } = useAdminDashboard();

	const props = defineProps({
		room: {
			type: Room,
			required: true,
		},
		disableDM: {
			type: Boolean,
			default: false,
		},
	});

	const realMembers = computed(() => {
		return props.room.getStateJoinedMembers().filter((m) => !m.state_key.startsWith('@notices_user:'));
	});

	const memberIds = computed(() => {
		if (props.room.isDirectMessageRoom()) {
			return [...new Set(realMembers.value.map((x) => x.sender))];
		}
		const stewards = getStewardsInRoom() ?? [];
		return realMembers.value.filter((member) => !stewards.map((stewardId) => stewardId.userId).includes(member.sender)).map((member) => member.sender);
	});

	const canWhisperFromContextMenu = computed(() => {
		const currentUserId = user.user?.userId;
		if (!currentUserId) return false;
		const currentUserPowerLevel = props.room.getPowerLevel(currentUserId);
		return currentUserPowerLevel >= UserPowerLevel.Steward;
	});

	async function contactSteward() {
		const stewards = getStewardsInRoom() ?? [];
		const stewardIds = stewards.map((steward) => steward.userId);
		await rooms.createStewardRoomOrModify(props.room.roomId, stewardIds);
	}

	async function startDM(userId: string) {
		if (sidebar.isMobile.value) sidebar.close();
		await dm.goToUserDM(userId);
	}

	function getUserContextMenuItems(userId: string) {
		const items = [{ label: t('menu.direct_message'), icon: 'chat-circle', onClick: () => startDM(userId) }];
		if (canWhisperFromContextMenu.value) {
			items.push({
				label: t('menu.whisper'),
				icon: 'whisper',
				onClick: () => startWhisperToUser(userId),
			});
		}
		return items;
	}

	function startWhisperToUser(userId: string) {
		if (sidebar.isMobile.value) sidebar.close();
		messageActions.replyingTo = undefined;
		messageActions.whisperingToUserId = userId;
		messageActions.whisperingToDisplayName = user.userDisplayName(userId);
		messageActions.whisperingToEventId = undefined;
	}
</script>
