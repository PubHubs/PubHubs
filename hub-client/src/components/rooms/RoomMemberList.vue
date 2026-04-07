<template>
	<div class="flex h-full flex-col overflow-y-hidden py-4">
		<SidebarHeader :title="$t('rooms.members')" />
		<div class="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
			<!-- Contact steward card -->
			<div v-if="stewards && stewards.length > 0" class="hover:bg-surface-high flex cursor-pointer items-center gap-4 rounded-md p-2" @click="contactSteward">
				<div class="bg-accent-steward/10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
					<Icon type="lifebuoy" size="md" class="text-accent-steward" />
				</div>
				<div class="flex flex-col">
					<span class="font-bold">{{ t('rooms.contact_steward_title') }}</span>
					<span class="text-on-surface-dim text-label-small">{{ t('rooms.contact_steward_subtitle') }}</span>
				</div>
			</div>

			<div v-if="roles.userIsStewardOrHigher() && admins && admins.length > 0" class="pb-4">
				<CollapsibleHeader :label="$t('moderation.admins')">
					<template #right>
						<div class="flex items-center gap-1">
							<div>{{ admins.length }}</div>
							<Icon type="user"></Icon>
						</div>
					</template>
					<div
						v-for="admin in admins"
						:key="admin.userId"
						class="flex w-full items-center gap-2 rounded-md p-2"
						:class="contextMenuStore.isOpen && contextMenuStore.currentTargetId === admin.userId && 'bg-surface-low'"
						v-context-menu="admin.userId !== user.user?.userId && !props.disableDM ? (evt: any) => openMenu(evt, getUserPowerUserMenuItems(admin.userId), admin.userId) : undefined"
					>
						<Avatar :avatar-url="user.userAvatar(admin.userId)" :userId="admin.userId" :enableDM="false" class="h-8 w-8 shrink-0"></Avatar>
						<UserDisplayName :userId="admin.userId" :user-display-name="user.userDisplayName(admin.userId)" :enableDM="false"></UserDisplayName>
					</div>
				</CollapsibleHeader>
			</div>

			<div v-if="stewards && stewards.length > 0" class="pb-4">
				<CollapsibleHeader :label="$t('rooms.stewards')">
					<template #right>
						<div class="flex items-center gap-1">
							<div>{{ stewards.length }}</div>
							<Icon type="user"></Icon>
						</div>
					</template>
					<div
						v-for="steward in stewards"
						:key="steward.userId"
						class="flex w-full items-center gap-2 rounded-md p-2"
						:class="contextMenuStore.isOpen && contextMenuStore.currentTargetId === steward.userId && 'bg-surface-low'"
						v-context-menu="steward.userId !== user.user?.userId && !props.disableDM ? (evt: any) => openMenu(evt, getUserPowerUserMenuItems(steward.userId), steward.userId) : undefined"
					>
						<Avatar :avatar-url="user.userAvatar(steward.userId)" :userId="steward.userId" :enableDM="false" class="h-8 w-8 shrink-0"></Avatar>
						<UserDisplayName :userId="steward.userId" :user-display-name="user.userDisplayName(steward.userId)" :enableDM="false"></UserDisplayName>
					</div>
				</CollapsibleHeader>
			</div>

			<div v-if="nonPowerMemberIds && nonPowerMemberIds.length > 0" class="">
				<CollapsibleHeader :label="$t('rooms.members')">
					<template #right>
						<div class="flex items-center gap-1">
							<div>{{ nonPowerMemberIds.length }}</div>
							<Icon type="user"></Icon>
						</div>
					</template>
					<div
						v-for="userId in nonPowerMemberIds"
						:key="userId"
						class="flex w-full items-center gap-2 rounded-md p-2"
						:class="contextMenuStore.isOpen && contextMenuStore.currentTargetId === userId && 'bg-surface-low'"
						v-context-menu="(evt: any) => openMenu(evt, getMemberContextMenuItems(userId), userId)"
					>
						<Avatar :avatar-url="user.userAvatar(userId)" :userId="userId" :enableDM="false" class="h-8 w-8 shrink-0"></Avatar>
						<UserDisplayName :userId="userId" :user-display-name="user.userDisplayName(userId)" :enableDM="false"></UserDisplayName>
					</div>
				</CollapsibleHeader>
			</div>
			<div v-if="roles.userIsStewardOrHigher() && hasSanctionedMembers" class="grow">
				<CollapsibleHeader :label="t('moderation.sanctioned_members')">
					<template #right>
						<div class="flex items-center gap-1">
							<div>{{ redCardMembers.length + yellowCardMembers.length + revokedRedCardMembers.length }}</div>
							<Icon type="user"></Icon>
						</div>
					</template>
					<div
						v-for="yellowCard in yellowCardMembers"
						:key="yellowCard.userId"
						class="flex w-full items-center gap-2 rounded-md p-2"
						:class="contextMenuStore.isOpen && contextMenuStore.currentTargetId === yellowCard.userId && 'bg-surface-low'"
						v-context-menu="(evt: any) => openMenu(evt, getYellowCardContextMenuItems(yellowCard.userId), yellowCard.userId)"
					>
						<Avatar :avatar-url="user.userAvatar(yellowCard.userId)" :userId="yellowCard.userId" :enableDM="false" class="h-8 w-8 shrink-0"></Avatar>
						<UserDisplayName :userId="yellowCard.userId" :user-display-name="user.userDisplayName(yellowCard.userId)" :enableDM="false"></UserDisplayName>
						<Icon type="exclamation-mark" class="text-accent-yellow"></Icon>
					</div>
					<div
						v-for="redCard in redCardMembers"
						:key="redCard.userId"
						class="flex w-full items-center gap-2 rounded-md p-2"
						:class="contextMenuStore.isOpen && contextMenuStore.currentTargetId === redCard.userId && 'bg-surface-low'"
						v-context-menu="(evt: any) => openMenu(evt, getRedCardContextMenuItems(redCard.userId), redCard.userId)"
					>
						<Avatar :avatar-url="user.userAvatar(redCard.userId)" :userId="redCard.userId" :enableDM="false" class="h-8 w-8 shrink-0"></Avatar>
						<UserDisplayName :userId="redCard.userId" :user-display-name="user.userDisplayName(redCard.userId)" :enableDM="false"></UserDisplayName>
						<Icon type="exclamation-mark" class="text-button-red"></Icon>
					</div>
					<div
						v-for="revoked in revokedRedCardMembers"
						:key="revoked.userId"
						class="flex w-full items-center gap-2 rounded-md p-2"
						:class="contextMenuStore.isOpen && contextMenuStore.currentTargetId === revoked.userId && 'bg-surface-low'"
						v-context-menu="(evt: any) => openMenu(evt, getYellowCardContextMenuItems(revoked.userId), revoked.userId)"
					>
						<Avatar :avatar-url="user.userAvatar(revoked.userId)" :userId="revoked.userId" :enableDM="false" class="h-8 w-8 shrink-0"></Avatar>
						<UserDisplayName :userId="revoked.userId" :user-display-name="user.userDisplayName(revoked.userId)" :enableDM="false"></UserDisplayName>
						<Icon type="exclamation-mark" class=""></Icon>
					</div>
				</CollapsibleHeader>
			</div>
		</div>

		<!-- Card reason dialogs -->
		<IssueCardDialog v-if="cardDialog.visible" :card-type="cardDialog.type" @close="cardDialog.visible = false" @submit="onCardDialogSubmit" />
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { capitalize } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import IssueCardDialog from '@hub-client/components/forms/issueCardDialog.vue';
	import UserDisplayName from '@hub-client/components/rooms/UserDisplayName.vue';
	import Avatar from '@hub-client/components/ui/Avatar.vue';
	import CollapsibleHeader from '@hub-client/components/ui/CollapsibleHeader.vue';
	import SidebarHeader from '@hub-client/components/ui/SidebarHeader.vue';

	// Composables
	import { useModeration } from '@hub-client/composables/moderation.composable';
	import { useRoles } from '@hub-client/composables/roles.composable';
	import { useDirectMessage } from '@hub-client/composables/useDirectMessage';
	import { useSidebar } from '@hub-client/composables/useSidebar';

	// Models
	import Room from '@hub-client/models/rooms/Room';
	import { UserAction } from '@hub-client/models/users/TUser';

	// Store
	import { FeatureFlag, useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	// New design
	import { useContextMenu } from '@hub-client/new-design/composables/contextMenu.composable';
	import { ContextVariant, MenuItem } from '@hub-client/new-design/models/contextMenu.models';
	import { useContextMenuStore } from '@hub-client/new-design/stores/contextMenu.store';

	const { t } = useI18n();
	const user = useUser();
	const settings = useSettings();
	const dm = useDirectMessage();
	const roles = useRoles();
	const sidebar = useSidebar();
	const { openMenu } = useContextMenu();
	const contextMenuStore = useContextMenuStore();

	const {
		stewards,
		admins,
		nonPowerMemberIds,
		yellowCardMembers,
		redCardMembers,
		revokedRedCardMembers,
		hasSanctionedMembers,
		canWhisperFromContextMenu,
		cardDialog,
		openCardDialog,
		onCardDialogSubmit,
		revokeRedCard,
		contactSteward,
		startWhisperToMember,
	} = useModeration();

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

	const startDM = async (userId: string) => {
		if (sidebar.isMobile.value) sidebar.close();
		await dm.goToUserDM(userId);
	};

	const getMemberContextMenuItems = (memberId: string): MenuItem[] => {
		if (memberId === user.user?.userId || props.disableDM) return [];
		const social: MenuItem[] = [{ label: t('menu.direct_message'), icon: 'chat-circle', onClick: () => startDM(memberId) }];
		const stewardActions: MenuItem[] = [];
		const destructive: MenuItem[] = [];

		if (canWhisperFromContextMenu.value && settings.isFeatureEnabled(FeatureFlag.whisper)) {
			stewardActions.push({
				label: t('menu.whisper'),
				icon: 'whisper',
				onClick: () => startWhisperToMember(memberId),
			});
		}

		if (roles.userHasPermissionForAction(UserAction.Kick)) {
			stewardActions.push({
				label: capitalize(t('moderation.issue_yellow_card')),
				icon: 'exclamation-mark',
				onClick: () => openCardDialog('yellow', props.room.roomId, memberId),
				variant: ContextVariant.yellow,
				title: t('moderation.issue_yellow_card_info'),
			});
		}

		if (roles.userHasPermissionForAction(UserAction.Ban)) {
			destructive.push({
				label: capitalize(t('moderation.issue_red_card')),
				icon: 'exclamation-mark',
				onClick: () => openCardDialog('red', props.room.roomId, memberId),
				variant: ContextVariant.delicate,
				title: t('moderation.issue_red_card_info'),
			});
		}

		const divider: MenuItem = { divider: true, label: '' };
		return [social, stewardActions, destructive].filter((g) => g.length > 0).flatMap((g, i) => (i === 0 ? g : [divider, ...g]));
	};

	const getYellowCardContextMenuItems = (memberId: string): MenuItem[] => {
		if (memberId === user.user?.userId || props.disableDM) return [];
		const destructive: MenuItem[] = [];
		const social: MenuItem[] = [{ label: t('menu.direct_message'), icon: 'chat-circle', onClick: () => startDM(memberId) }];

		if (roles.userHasPermissionForAction(UserAction.Ban)) {
			destructive.push({
				label: capitalize(t('moderation.issue_red_card')),
				icon: 'exclamation-mark',
				onClick: () => openCardDialog('red', props.room.roomId, memberId),
				variant: ContextVariant.delicate,
				title: t('moderation.issue_red_card_info'),
			});
		}

		const divider: MenuItem = { divider: true, label: '' };
		return [social, destructive].filter((g) => g.length > 0).flatMap((g, i) => (i === 0 ? g : [divider, ...g]));
	};

	const getRedCardContextMenuItems = (memberId: string): MenuItem[] => {
		if (memberId === user.user?.userId || props.disableDM) return [];
		const stewardActions: MenuItem[] = [];
		const social: MenuItem[] = [{ label: t('menu.direct_message'), icon: 'chat-circle', onClick: () => startDM(memberId) }];

		if (roles.userHasPermissionForAction(UserAction.Ban)) {
			stewardActions.push({
				label: capitalize(t('moderation.revoke_red_card')),
				icon: 'arrow-bend-up-left',
				onClick: () => revokeRedCard(props.room.roomId, memberId),
			});
		}

		const divider: MenuItem = { divider: true, label: '' };
		return [social, stewardActions].filter((g) => g.length > 0).flatMap((g, i) => (i === 0 ? g : [divider, ...g]));
	};

	function getUserPowerUserMenuItems(memberId: string) {
		if (memberId === user.user?.userId || props.disableDM) return [];
		const stewardActions: MenuItem[] = [];
		const social: MenuItem[] = [{ label: t('menu.direct_message'), icon: 'chat-circle', onClick: () => startDM(memberId) }];

		if (canWhisperFromContextMenu.value && settings.isFeatureEnabled(FeatureFlag.whisper)) {
			stewardActions.push({
				label: t('menu.whisper'),
				icon: 'whisper',
				onClick: () => startWhisperToMember(memberId),
			});
		}
		const divider: MenuItem = { divider: true, label: '' };
		return [social, stewardActions].filter((g) => g.length > 0).flatMap((g, i) => (i === 0 ? g : [divider, ...g]));
	}
</script>
