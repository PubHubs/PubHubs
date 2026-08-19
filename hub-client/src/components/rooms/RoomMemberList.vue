<template>
	<div class="flex h-full flex-col overflow-y-hidden py-200">
		<SidebarHeader :title="selectedMemberId && canOpenProfile ? $t('admin.user_details') : $t('rooms.members')" />
		<MemberProfilePanel
			v-if="selectedMemberId && canOpenProfile"
			:room="room"
			:user-id="selectedMemberId"
			:actions="selectedMemberActions"
			:warned="isSelectedUserWarned"
			:banned="isSelectedUserBanned"
			:formatted-timeout="selectedUserFormattedTimeout"
			@back="selectedMemberId = null"
		/>
		<div
			v-else
			class="flex flex-1 flex-col gap-200 overflow-y-auto px-200"
		>
			<!-- Contact steward card -->
			<div
				v-if="stewards.length > 0 && !isCurrentUserSteward"
				class="hover:bg-surface-elevated rounded-base flex cursor-pointer items-center gap-200 p-100"
				@click="contactSteward"
			>
				<div class="bg-accent-steward/10 flex h-600 w-600 shrink-0 items-center justify-center rounded-full">
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

			<RoomMemberSection
				:count="stewards.length"
				:label="$t('rooms.stewards')"
				class="pb-200"
			>
				<RoomMemberRow
					v-for="steward in stewards"
					:key="steward.userId"
					:clickable="canOpenProfile"
					:menu-items="getMemberMenuItems(steward.userId)"
					:room-id="room.roomId"
					:user-id="steward.userId"
					@select="openProfile"
				/>
			</RoomMemberSection>

			<RoomMemberSection
				:count="expertIds.length"
				:label="$t('rooms.experts')"
				class="pb-200"
			>
				<RoomMemberRow
					v-for="expertId in expertIds"
					:key="expertId"
					:clickable="canOpenProfile"
					:menu-items="getMemberMenuItems(expertId)"
					:room-id="room.roomId"
					:user-id="expertId"
					@select="openProfile"
				/>
			</RoomMemberSection>

			<RoomMemberSection
				:count="nonPowerMemberIds.length"
				:label="$t('rooms.members')"
			>
				<RoomMemberRow
					v-for="memberId in nonPowerMemberIds"
					:key="memberId"
					:clickable="canOpenProfile"
					:menu-items="getMemberMenuItems(memberId)"
					:room-id="room.roomId"
					:user-id="memberId"
					@select="openProfile"
				>
					<div class="flex flex-row gap-100">
						<Icon
							v-if="roles.userIsStewardOrHigher() && isUserWarned(memberId)"
							type="exclamation-mark"
							class="text-accent-yellow"
						/>
						<div
							v-if="roles.userIsStewardOrHigher() && isUserTimedOut(memberId)"
							class="text-accent-red-interactive gap-050 flex items-center"
						>
							<Icon
								type="clock"
								size="sm"
							/>
							<span class="text-label-small">{{
								formatTimeoutCountdown(activeTimeouts.find((timeout) => timeout.userId === memberId)?.timeout_until ?? 0)
							}}</span>
						</div>
					</div>
				</RoomMemberRow>
			</RoomMemberSection>

			<RoomMemberSection
				v-if="roles.userIsStewardOrHigher()"
				:count="numberOfSanctionedMembers"
				:label="t('moderation.sanctioned_members')"
			>
				<RoomMemberRow
					v-for="redCard in redCardMembers"
					:key="redCard.userId"
					:clickable="canOpenProfile"
					:menu-items="getRedCardMenuItems(redCard.userId)"
					:room-id="room.roomId"
					:user-id="redCard.userId"
					@select="openProfile"
				>
					<Icon
						type="exclamation-mark"
						class="text-accent-red-interactive"
					/>
				</RoomMemberRow>
				<RoomMemberRow
					v-for="revoked in revokedRedCardMembers"
					:key="revoked.userId"
					:clickable="canOpenProfile"
					:menu-items="getRevokedRedCardMenuItems(revoked.userId)"
					:room-id="room.roomId"
					:user-id="revoked.userId"
					@select="openProfile"
				>
					<Icon type="exclamation-mark" />
				</RoomMemberRow>
			</RoomMemberSection>
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

		<!-- Expert profile dialog (for editing own profile) -->
		<ExpertProfileDialog
			v-if="expertProfileDialog.visible"
			:error="expertProfileDialog.error"
			@close="closeExpertProfileDialog()"
			@submit="onExpertProfileDialogSubmit"
		/>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { capitalize, computed, onMounted, onUnmounted, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import ExpertProfileDialog from '@hub-client/components/forms/ExpertProfileDialog.vue';
	import IssueTimeoutDialog from '@hub-client/components/forms/IssueTimeoutDialog.vue';
	import KickDialog from '@hub-client/components/forms/KickDialog.vue';
	import IssueCardDialog from '@hub-client/components/forms/issueCardDialog.vue';
	import MemberProfilePanel from '@hub-client/components/rooms/MemberProfilePanel.vue';
	import RoomMemberRow from '@hub-client/components/rooms/RoomMemberRow.vue';
	import RoomMemberSection from '@hub-client/components/rooms/RoomMemberSection.vue';
	import SidebarHeader from '@hub-client/components/ui/SidebarHeader.vue';

	// Composables
	import { useModerationBase } from '@hub-client/composables/moderation/base.composable';
	import { useExpertVerification } from '@hub-client/composables/moderation/expert-verification.composable';
	import { useModerationKick } from '@hub-client/composables/moderation/kick.composable';
	import { useModerationRedCard } from '@hub-client/composables/moderation/red-card.composable';
	import { useModerationTimeout } from '@hub-client/composables/moderation/timeout.composable';
	import { useModerationWhisper } from '@hub-client/composables/moderation/whisper.composable';
	import { useModerationYellowCard } from '@hub-client/composables/moderation/yellow-card.composable';
	import { useRoles } from '@hub-client/composables/roles.composable';
	import { useDirectMessage } from '@hub-client/composables/useDirectMessage';
	import { useSidebar } from '@hub-client/composables/useSidebar';

	// Models
	import { ContextVariant, type MenuItem } from '@hub-client/models/components/contextMenu.models';
	import Room from '@hub-client/models/rooms/Room';
	import { UserAction, UserPowerLevel } from '@hub-client/models/users/TUser';

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

	const DIVIDER: MenuItem = { divider: true, label: '' };

	const base = useModerationBase();
	const { stewards, nonPowerMemberIds, contactSteward, allMembers, getCurrentRoom } = base;
	const isCurrentUserSteward = computed(() => stewards.value.some((s) => s.userId === user.user?.userId));

	// Experts are users with power level >= Expert (25) but < Steward (50)
	const expertIds = computed(() => {
		const currentRoom = getCurrentRoom();
		if (!currentRoom) return [];

		return allMembers.value.filter((userId) => {
			const powerLevel = currentRoom.getPowerLevel(userId);
			return powerLevel >= UserPowerLevel.Expert && powerLevel < UserPowerLevel.Steward;
		});
	});
	const { activeYellowCards, yellowCardDialog, openYellowCardDialog, onYellowCardDialogSubmit, revokeYellowCard, isUserWarned } =
		useModerationYellowCard(base);
	const { redCardMembers, revokedRedCardMembers, redCardDialog, openRedCardDialog, onRedCardDialogSubmit, isUserBanned, revokeRedCard } =
		useModerationRedCard(base);
	const { kickDialog, openKickDialog, onKickDialogSubmit } = useModerationKick();
	const { timeoutDialog, activeTimeouts, isUserTimedOut, canTimeoutUser, refreshTimeoutStatus, revokeTimeout, openTimeoutDialog, onTimeoutDialogSubmit } =
		useModerationTimeout(base);
	const { canWhisperFromContextMenu, startWhisperToMember } = useModerationWhisper();
	const { expertProfileDialog, isCurrentUserExpert, openExpertProfileDialog, closeExpertProfileDialog, onExpertProfileDialogSubmit } =
		useExpertVerification();

	const numberOfSanctionedMembers = computed(() => redCardMembers.value.length + revokedRedCardMembers.value.length);
	const canWhisper = computed(() => canWhisperFromContextMenu.value && settings.isFeatureEnabled(FeatureFlag.whisper));
	const isSelectedUserWarned = computed(() => (selectedMemberId.value ? isUserWarned(selectedMemberId.value) : false));
	const isSelectedUserBanned = computed(() => (selectedMemberId.value ? isUserBanned(selectedMemberId.value) : false));
	const selectedUserFormattedTimeout = computed(() =>
		formatTimeoutCountdown(activeTimeouts.value.find((timeout) => timeout.userId === selectedMemberId.value)?.timeout_until ?? 0),
	);
	// Nested member profile panel. State lives in useSidebar so it can also be
	// opened from elsewhere (e.g. a message bubble's "user details" action).
	// Only enabled for non-DM rooms (public/secured); group DMs are direct message rooms and excluded.
	const selectedMemberId = sidebar.selectedMemberId;
	const canOpenProfile = computed(() => !props.room.isDirectMessageRoom());

	// Build the same actions the context menu offers, picking the builder that matches the member's state.
	const selectedMemberActions = computed<MenuItem[]>(() => {
		const id = selectedMemberId.value;
		if (!id) return [];
		if (redCardMembers.value.some((m) => m.userId === id)) return getRedCardUserDetails(id);
		if (stewards.value.some((s) => s.userId === id) || expertIds.value.some((expertId) => expertId === id)) return getStewardMenuItems(id);
		return getMemberUserDetailsMenuItems(id);
	});

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
	const openProfile = (memberId: string) => {
		if (!canOpenProfile.value || memberId === user.user?.userId) return;
		selectedMemberId.value = memberId;
	};
	/**
	 * Formats the remaining timeout duration rounded down to minutes.
	 * @param timeoutUntil - Unix timestamp in milliseconds when timeout expires
	 * @returns Formatted string like "2h 30m", "45m", or "< 1m"
	 */
	const formatTimeoutCountdown = (timeoutUntil: number): string => {
		// Reference now.value to make this reactive
		if (timeoutUntil <= 0) return '';
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

	// Context menu items ---------------------------------------------------------
	// Every member menu is a social group plus an optional moderation group, so the
	// builders below only describe the moderation items that their category adds.

	/** Spreads into a menu group only when the guard holds, so groups can stay flat literals. */
	const when = (condition: boolean, ...items: MenuItem[]): MenuItem[] => (condition ? items : []);

	const userDetailsItem = (memberId: string): MenuItem => ({
		label: t('admin.user_details'),
		icon: 'user-circle',
		onClick: () => sidebar.openMemberProfile(memberId),
	});

	const directMessageItem = (memberId: string): MenuItem => ({
		label: t('menu.direct_message'),
		icon: 'chat-circle',
		onClick: () => startDM(memberId),
	});

	const whisperItem = (memberId: string): MenuItem => ({
		label: t('menu.whisper'),
		icon: 'whisper',
		onClick: () => startWhisperToMember(memberId),
		variant: ContextVariant.steward,
	});

	const timeOutItem = (memberId: string): MenuItem => ({
		label: capitalize(t('moderation.issue_timeout')),
		icon: 'clock',
		onClick: () => openTimeoutDialog(props.room.roomId, memberId),
		variant: ContextVariant.steward,
		title: capitalize(t('moderation.issue_timeout_info', { name: user.userDisplayName(memberId) ?? memberId })),
	});

	const revokeTimeoutItem = (memberId: string): MenuItem => ({
		label: capitalize(t('moderation.revoke_timeout')),
		icon: 'clock-counter-clockwise',
		onClick: () => revokeTimeout(props.room.roomId, memberId),
		variant: ContextVariant.steward,
	});

	const revokeRedCardItem = (memberId: string): MenuItem => ({
		label: capitalize(t('moderation.revoke_red_card')),
		icon: 'arrows-counter-clockwise',
		onClick: () => revokeRedCard(props.room.roomId, memberId),
		variant: ContextVariant.steward,
	});

	const yellowCardItem = (memberId: string): MenuItem => ({
		label: capitalize(t('moderation.issue_yellow_card')),
		icon: 'exclamation-mark',
		onClick: () => openYellowCardDialog(props.room.roomId, memberId),
		variant: ContextVariant.yellow,
		title: capitalize(t('moderation.issue_yellow_card_info')),
	});

	const redCardItem = (memberId: string): MenuItem => ({
		label: capitalize(t('moderation.issue_red_card')),
		icon: 'exclamation-mark',
		onClick: () => openRedCardDialog(props.room.roomId, memberId),
		variant: ContextVariant.delicate,
		title: capitalize(t('moderation.issue_red_card_info')),
	});

	const revokeYellowCardItem = (memberId: string) => ({
		label: capitalize(t('moderation.revoke_yellow_card')),
		icon: 'arrows-counter-clockwise',
		onClick: () => revokeYellowCard(props.room.roomId, memberId),
		variant: ContextVariant.steward,
	});

	const kickItem = (memberId: string) => ({
		label: capitalize(t('moderation.remove_from_room')),
		icon: 'boot',
		onClick: () => openKickDialog(props.room.roomId, memberId),
		variant: ContextVariant.steward,
	});

	const getSelfExpertMenuItems = (): MenuItem[] => [
		{
			label: capitalize(t('expert.edit_profile')),
			icon: 'seal-check',
			onClick: () => openExpertProfileDialog(),
			variant: ContextVariant.expert,
		},
	];

	/**
	 * Joins the social and moderation groups with a divider, dropping empty groups.
	 * @param moderation - Moderation items this member's category offers
	 * @param social - Overrides the default social group (user details + direct message)
	 */
	const buildMemberMenu = (memberId: string, moderation: MenuItem[] = [], social?: MenuItem[]): MenuItem[] => {
		// Own row: the only self action is editing the expert profile.
		if (memberId === user.user?.userId) return isCurrentUserExpert.value ? getSelfExpertMenuItems() : [];
		if (props.disableDM) return [];

		const groups = [social ?? [userDetailsItem(memberId), directMessageItem(memberId)], moderation];
		return groups.filter((group) => group.length > 0).flatMap((group, index) => (index === 0 ? group : [DIVIDER, ...group]));
	};

	/** Default row menu, shared by  experts and plain members. */
	const getMemberMenuItems = (memberId: string): MenuItem[] => buildMemberMenu(memberId, when(canWhisper.value, whisperItem(memberId)));

	const getStewardMenuItems = (memberId: string): MenuItem[] =>
		buildMemberMenu(memberId, when(canWhisper.value, whisperItem(memberId)), [directMessageItem(memberId)]);

	const getRevokedRedCardMenuItems = (memberId: string): MenuItem[] => buildMemberMenu(memberId);

	const getRedCardMenuItems = (memberId: string): MenuItem[] =>
		buildMemberMenu(memberId, when(roles.userHasPermissionForAction(UserAction.Ban), revokeRedCardItem(memberId)));

	const getRedCardUserDetails = (memberId: string): MenuItem[] =>
		buildMemberMenu(memberId, when(roles.userHasPermissionForAction(UserAction.Ban), revokeRedCardItem(memberId)), [directMessageItem(memberId)]);

	/** Full moderation set, offered from the member profile panel. */
	const getMemberUserDetailsMenuItems = (memberId: string): MenuItem[] => {
		const canKick = roles.userHasPermissionForAction(UserAction.Kick);
		const canBan = roles.userHasPermissionForAction(UserAction.Ban);
		// Moderation only applies to plain members, never to stewards or experts.
		const isPlainMember = nonPowerMemberIds.value.includes(memberId);

		const moderation: MenuItem[] = [
			...when(canWhisper.value && isPlainMember, whisperItem(memberId)),
			...when(canKick && isPlainMember, kickItem(memberId)),
			...when(
				roles.userHasPermissionForAction(UserAction.Timeout) && canTimeoutUser(memberId) && isPlainMember,
				isUserTimedOut(memberId) ? revokeTimeoutItem(memberId) : timeOutItem(memberId),
			),
			...when(canKick && isPlainMember, yellowCardItem(memberId)),
			...when(canBan && isPlainMember, redCardItem(memberId)),
			...when(canKick && isPlainMember && isUserWarned(memberId), revokeYellowCardItem(memberId)),
		];

		return buildMemberMenu(memberId, moderation, [directMessageItem(memberId)]);
	};
	// Reset the panel when navigating to a different room (component persists across room changes).
	watch(
		() => props.room.roomId,
		() => {
			selectedMemberId.value = null;
		},
	);

	// The selected member is still shown as long as they appear in any member category.
	// Banned (red card) and timed-out members stay listed, so only a kick or a voluntary
	// leave drops them out; in that case fall back to the list instead of showing stale data.
	const selectedMemberStillPresent = computed(() => {
		const id = selectedMemberId.value;
		if (!id) return true;
		return (
			stewards.value.some((s) => s.userId === id) ||
			expertIds.value.some((expertId) => expertId === id) ||
			nonPowerMemberIds.value.includes(id) ||
			activeYellowCards.value.some((m) => m.userId === id) ||
			redCardMembers.value.some((m) => m.userId === id) ||
			revokedRedCardMembers.value.some((m) => m.userId === id) ||
			activeTimeouts.value.some((m) => m.userId === id)
		);
	});
	watch(selectedMemberStillPresent, (present) => {
		if (!present) selectedMemberId.value = null;
	});
</script>
