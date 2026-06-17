<template>
	<div class="flex h-full flex-col overflow-y-hidden py-4">
		<SidebarHeader :title="$t('rooms.members')" />
		<div class="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
			<!-- Contact steward card -->
			<div
				v-if="stewards && stewards.length > 0 && !isCurrentUserSteward"
				class="hover:bg-surface-elevated rounded-base flex cursor-pointer items-center gap-4 p-2"
				@click="contactSteward"
			>
				<div class="bg-accent-steward/10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
					<Icon
						type="lifebuoy"
						class="text-accent-steward"
					/>
				</div>
				<div class="flex flex-col">
					<span class="font-bold">{{ t('rooms.contact_steward_title') }}</span>
					<span class="text-on-surface-dim text-label-small">{{ t('rooms.contact_steward_subtitle') }}</span>
				</div>
			</div>

			<div
				v-if="stewards && stewards.length > 0"
				class="pb-4"
			>
				<CollapsibleHeader :label="$t('rooms.stewards')">
					<template #right>
						<Pill :value="stewards.length" />
					</template>
					<div
						v-for="steward in stewards"
						:key="steward.userId"
						v-context-menu="
							steward.userId !== user.user?.userId && !props.disableDM
								? (evt: any) => openMenu(evt, getPowerUserMenuItems(steward.userId), steward.userId)
								: undefined
						"
						class="flex w-full items-center rounded-md p-2"
						:class="contextMenuStore.isOpen && contextMenuStore.currentTargetId === steward.userId && 'bg-surface-elevated'"
					>
						<UserBadge
							:user-id="steward.userId"
							size="lg"
						/>
					</div>
				</CollapsibleHeader>
			</div>

			<div v-if="nonPowerMemberIds && nonPowerMemberIds.length > 0">
				<CollapsibleHeader :label="$t('rooms.members')">
					<template #right>
						<Pill :value="nonPowerMemberIds.length" />
					</template>
					<div
						v-for="memberId in nonPowerMemberIds"
						:key="memberId"
						v-context-menu="(evt: any) => openMenu(evt, getMemberContextMenuItems(memberId), memberId)"
						class="flex w-full items-center rounded-md p-2"
						:class="contextMenuStore.isOpen && contextMenuStore.currentTargetId === memberId && 'bg-surface-elevated'"
					>
						<UserBadge
							:user-id="memberId"
							size="lg"
						/>
					</div>
				</CollapsibleHeader>
			</div>
			<div v-if="roles.userIsStewardOrHigher() && numberOfSanctionedMembers > 0">
				<CollapsibleHeader :label="t('moderation.sanctioned_members')">
					<template #right>
						<Pill :value="numberOfSanctionedMembers" />
					</template>
					<div
						v-for="yellowCard in activeYellowCards"
						:key="yellowCard.userId"
						v-context-menu="(evt: any) => openMenu(evt, getYellowCardContextMenuItems(yellowCard.userId), yellowCard.userId)"
						class="flex w-full items-center rounded-md p-2"
						:class="contextMenuStore.isOpen && contextMenuStore.currentTargetId === yellowCard.userId && 'bg-surface-elevated'"
					>
						<UserBadge
							:user-id="yellowCard.userId"
							size="lg"
						>
							<Icon
								type="exclamation-mark"
								class="text-accent-yellow"
							/>
						</UserBadge>
					</div>
					<div
						v-for="redCard in redCardMembers"
						:key="redCard.userId"
						v-context-menu="(evt: any) => openMenu(evt, getRedCardContextMenuItems(redCard.userId), redCard.userId)"
						class="flex w-full items-center rounded-md p-2"
						:class="contextMenuStore.isOpen && contextMenuStore.currentTargetId === redCard.userId && 'bg-surface-elevated'"
					>
						<UserBadge
							:user-id="redCard.userId"
							size="lg"
						>
							<Icon
								type="exclamation-mark"
								class="text-accent-red-interactive"
							/>
						</UserBadge>
					</div>
					<div
						v-for="revoked in revokedRedCardMembers"
						:key="revoked.userId"
						v-context-menu="(evt: any) => openMenu(evt, getYellowCardContextMenuItems(revoked.userId), revoked.userId)"
						class="flex w-full items-center rounded-md p-2"
						:class="contextMenuStore.isOpen && contextMenuStore.currentTargetId === revoked.userId && 'bg-surface-elevated'"
					>
						<UserBadge
							:user-id="revoked.userId"
							size="lg"
						>
							<Icon type="exclamation-mark" />
						</UserBadge>
					</div>
					<div
						v-for="timeout in activeTimeouts"
						:key="timeout.userId"
						v-context-menu="(evt: any) => openMenu(evt, getTimeoutContextMenuItems(timeout.userId), timeout.userId)"
						class="flex w-full items-center rounded-md p-2"
						:class="contextMenuStore.isOpen && contextMenuStore.currentTargetId === timeout.userId && 'bg-surface-elevated'"
					>
						<UserBadge
							:user-id="timeout.userId"
							size="lg"
						>
							<div class="text-accent-red-interactive flex items-center gap-1">
								<Icon
									type="clock"
									size="sm"
								/>
								<span class="text-label-small">{{ formatTimeoutCountdown(timeout.timeout_until) }}</span>
							</div>
						</UserBadge>
					</div>
				</CollapsibleHeader>
			</div>
		</div>

		<!-- Yellow card dialog -->
		<IssueCardDialog
			v-if="yellowCardDialog.visible"
			card-type="yellow"
			@close="yellowCardDialog.visible = false"
			@submit="onYellowCardDialogSubmit"
		/>

		<!-- Red card dialog -->
		<IssueCardDialog
			v-if="redCardDialog.visible"
			card-type="red"
			@close="redCardDialog.visible = false"
			@submit="onRedCardDialogSubmit"
		/>

		<!-- Timeout dialog -->
		<IssueTimeoutDialog
			v-if="timeoutDialog.visible"
			:member-id="timeoutDialog.memberId"
			@close="timeoutDialog.visible = false"
			@submit="onTimeoutDialogSubmit"
		/>

		<!-- Kick dialog -->
		<KickDialog
			v-if="kickDialog.visible"
			:member-id="kickDialog.memberId"
			@close="kickDialog.visible = false"
			@submit="onKickDialogSubmit"
		/>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { capitalize, computed, onMounted, onUnmounted, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import Pill from '@hub-client/components/elements/Pill.vue';
	import IssueTimeoutDialog from '@hub-client/components/forms/IssueTimeoutDialog.vue';
	import KickDialog from '@hub-client/components/forms/KickDialog.vue';
	import IssueCardDialog from '@hub-client/components/forms/issueCardDialog.vue';
	import CollapsibleHeader from '@hub-client/components/ui/CollapsibleHeader.vue';
	import SidebarHeader from '@hub-client/components/ui/SidebarHeader.vue';
	import UserBadge from '@hub-client/components/ui/UserBadge.vue';

	// New design
	import { useContextMenu } from '@hub-client/composables/contextMenu.composable';
	// Composables
	import { useModerationBase } from '@hub-client/composables/moderation/base.composable';
	import { useModerationKick } from '@hub-client/composables/moderation/kick.composable';
	import { useModerationMembership } from '@hub-client/composables/moderation/membership.composable';
	import { useModerationRedCard } from '@hub-client/composables/moderation/red-card.composable';
	import { useModerationTimeout } from '@hub-client/composables/moderation/timeout.composable';
	import { useModerationWhisper } from '@hub-client/composables/moderation/whisper.composable';
	import { useModerationYellowCard } from '@hub-client/composables/moderation/yellow-card.composable';
	import { useRoles } from '@hub-client/composables/roles.composable';
	import { useDirectMessage } from '@hub-client/composables/useDirectMessage';
	import { useSidebar } from '@hub-client/composables/useSidebar';

	import { ContextVariant, type MenuItem } from '@hub-client/models/components/contextMenu.models';
	// Models
	import Room from '@hub-client/models/rooms/Room';
	import { UserAction } from '@hub-client/models/users/TUser';

	import { useContextMenuStore } from '@hub-client/stores/contextMenu.store';
	// Store
	import { FeatureFlag, useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

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
	const { t } = useI18n();
	const user = useUser();
	const settings = useSettings();
	const dm = useDirectMessage();
	const roles = useRoles();
	const sidebar = useSidebar();
	const { openMenu } = useContextMenu();
	const contextMenuStore = useContextMenuStore();

	const base = useModerationBase();
	const { stewards: baseStewards, nonPowerMemberIds } = base;
	const stewards = computed(() => [...baseStewards.value]);
	const isCurrentUserSteward = computed(() => stewards.value.some((s) => s.userId === user.user?.userId));
	const { activeYellowCards, yellowCardDialog, openYellowCardDialog, onYellowCardDialogSubmit } = useModerationYellowCard(base);
	const { redCardMembers, revokedRedCardMembers, redCardDialog, openRedCardDialog, onRedCardDialogSubmit, revokeRedCard } = useModerationRedCard(base);
	const { kickDialog, openKickDialog, onKickDialogSubmit } = useModerationKick();
	const { timeoutDialog, activeTimeouts, isUserTimedOut, canTimeoutUser, refreshTimeoutStatus, revokeTimeout, openTimeoutDialog, onTimeoutDialogSubmit } =
		useModerationTimeout(base);
	const { contactSteward } = useModerationMembership(base);
	const { canWhisperFromContextMenu, startWhisperToMember } = useModerationWhisper();
	const numberOfSanctionedMembers = computed(
		() => redCardMembers.value.length + activeYellowCards.value.length + revokedRedCardMembers.value.length + activeTimeouts.value.length,
	);

	// Refs
	const now = ref(Date.now());
	let timeoutIntervalId: ReturnType<typeof setInterval> | undefined;

	// Lifecycle
	onMounted(() => {
		// Update every minute for the timeout countdown display
		timeoutIntervalId = setInterval(() => {
			now.value = Date.now();
			// Check if any timeouts have expired and refresh the status
			if (activeTimeouts.value.some((t) => t.timeout_until <= now.value)) {
				refreshTimeoutStatus();
			}
		}, 60000);
	});

	onUnmounted(() => {
		if (timeoutIntervalId) {
			clearInterval(timeoutIntervalId);
		}
	});

	// Functions
	/**
	 * Formats the remaining timeout duration rounded down to minutes.
	 * @param timeoutUntil - Unix timestamp in milliseconds when timeout expires
	 * @returns Formatted string like "2h 30m", "45m", or "< 1m"
	 */
	const formatTimeoutCountdown = (timeoutUntil: number): string => {
		// Reference now.value to make this reactive
		const remainingMs = Math.max(0, timeoutUntil - now.value);
		const totalSeconds = Math.floor(remainingMs / 1000);
		const totalMinutes = Math.floor(totalSeconds / 60);

		if (totalMinutes === 0) return '< 1m';
		if (totalMinutes < 60) return `${totalMinutes}m`;

		const hours = Math.floor(totalMinutes / 60);
		const mins = totalMinutes % 60;

		if (hours >= 24) {
			const days = Math.floor(hours / 24);
			const remainingHours = hours % 24;
			return `${days}d ${remainingHours}h`;
		}

		return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
	};

	const startDM = async (userId: string) => {
		if (sidebar.isMobile.value) sidebar.close();
		await dm.goToUserDM(userId);
	};

	const getMemberContextMenuItems = (memberId: string): MenuItem[] => {
		if (memberId === user.user?.userId || props.disableDM) return [];
		const social: MenuItem[] = [{ label: t('menu.direct_message'), icon: 'chat-circle', onClick: () => startDM(memberId) }];
		const stewardActions: MenuItem[] = [];

		if (canWhisperFromContextMenu.value && settings.isFeatureEnabled(FeatureFlag.whisper)) {
			stewardActions.push({
				label: t('menu.whisper'),
				icon: 'whisper',
				onClick: () => startWhisperToMember(memberId),
				variant: ContextVariant.steward,
			});
		}
		if (roles.userHasPermissionForAction(UserAction.Kick)) {
			stewardActions.push({
				label: capitalize(t('moderation.remove_from_room')),
				icon: 'boot',
				onClick: () => openKickDialog(props.room.roomId, memberId),
				variant: ContextVariant.steward,
			});
		}
		if (roles.userHasPermissionForAction(UserAction.Timeout) && canTimeoutUser(memberId)) {
			if (isUserTimedOut(memberId)) {
				stewardActions.push({
					label: capitalize(t('moderation.revoke_timeout')),
					icon: 'clock-counter-clockwise',
					onClick: () => revokeTimeout(props.room.roomId, memberId),
					variant: ContextVariant.steward,
				});
			} else {
				stewardActions.push({
					label: capitalize(t('moderation.issue_timeout')),
					icon: 'clock',
					onClick: () => openTimeoutDialog(props.room.roomId, memberId),
					variant: ContextVariant.steward,
					title: capitalize(t('moderation.issue_timeout_info', { name: user.userDisplayName(memberId) ?? memberId })),
				});
			}
		}
		if (roles.userHasPermissionForAction(UserAction.Kick)) {
			stewardActions.push({
				label: capitalize(t('moderation.issue_yellow_card')),
				icon: 'exclamation-mark',
				onClick: () => openYellowCardDialog(props.room.roomId, memberId),
				variant: ContextVariant.yellow,
				title: capitalize(t('moderation.issue_yellow_card_info')),
			});
		}

		if (roles.userHasPermissionForAction(UserAction.Ban)) {
			stewardActions.push({
				label: capitalize(t('moderation.issue_red_card')),
				icon: 'exclamation-mark',
				onClick: () => openRedCardDialog(props.room.roomId, memberId),
				variant: ContextVariant.delicate,
				title: capitalize(t('moderation.issue_red_card_info')),
			});
		}

		const divider: MenuItem = { divider: true, label: '' };
		return [social, stewardActions].filter((g) => g.length > 0).flatMap((g, i) => (i === 0 ? g : [divider, ...g]));
	};

	const getYellowCardContextMenuItems = (memberId: string): MenuItem[] => {
		if (memberId === user.user?.userId || props.disableDM) return [];
		const stewardActions: MenuItem[] = [];
		const social: MenuItem[] = [{ label: t('menu.direct_message'), icon: 'chat-circle', onClick: () => startDM(memberId) }];

		if (roles.userHasPermissionForAction(UserAction.Ban)) {
			stewardActions.push({
				label: capitalize(t('moderation.issue_red_card')),
				icon: 'exclamation-mark',
				onClick: () => openRedCardDialog(props.room.roomId, memberId),
				variant: ContextVariant.delicate,
				title: capitalize(t('moderation.issue_red_card_info')),
			});
		}

		const divider: MenuItem = { divider: true, label: '' };
		return [social, stewardActions].filter((g) => g.length > 0).flatMap((g, i) => (i === 0 ? g : [divider, ...g]));
	};

	const getRedCardContextMenuItems = (memberId: string): MenuItem[] => {
		if (memberId === user.user?.userId || props.disableDM) return [];
		const stewardActions: MenuItem[] = [];
		const social: MenuItem[] = [{ label: t('menu.direct_message'), icon: 'chat-circle', onClick: () => startDM(memberId) }];

		if (roles.userHasPermissionForAction(UserAction.Ban)) {
			stewardActions.push({
				label: capitalize(t('moderation.revoke_red_card')),
				icon: 'arrows-counter-clockwise',
				onClick: () => revokeRedCard(props.room.roomId, memberId),
				variant: ContextVariant.steward,
			});
		}

		const divider: MenuItem = { divider: true, label: '' };
		return [social, stewardActions].filter((g) => g.length > 0).flatMap((g, i) => (i === 0 ? g : [divider, ...g]));
	};

	function getPowerUserMenuItems(memberId: string) {
		if (memberId === user.user?.userId || props.disableDM) return [];
		const stewardActions: MenuItem[] = [];
		const social: MenuItem[] = [{ label: t('menu.direct_message'), icon: 'chat-circle', onClick: () => startDM(memberId) }];

		if (canWhisperFromContextMenu.value && settings.isFeatureEnabled(FeatureFlag.whisper)) {
			stewardActions.push({
				label: t('menu.whisper'),
				icon: 'whisper',
				onClick: () => startWhisperToMember(memberId),
				variant: ContextVariant.steward,
			});
		}
		const divider: MenuItem = { divider: true, label: '' };
		return [social, stewardActions].filter((g) => g.length > 0).flatMap((g, i) => (i === 0 ? g : [divider, ...g]));
	}

	const getTimeoutContextMenuItems = (memberId: string): MenuItem[] => {
		if (memberId === user.user?.userId || props.disableDM) return [];
		const stewardActions: MenuItem[] = [];
		const social: MenuItem[] = [{ label: t('menu.direct_message'), icon: 'chat-circle', onClick: () => startDM(memberId) }];

		if (roles.userHasPermissionForAction(UserAction.Timeout)) {
			stewardActions.push({
				label: capitalize(t('moderation.revoke_timeout')),
				icon: 'clock-counter-clockwise',
				onClick: () => revokeTimeout(props.room.roomId, memberId),
				variant: ContextVariant.steward,
			});
		}

		const divider: MenuItem = { divider: true, label: '' };
		return [social, stewardActions].filter((g) => g.length > 0).flatMap((g, i) => (i === 0 ? g : [divider, ...g]));
	};
</script>
