<template>
	<div class="flex h-full flex-col p-4">
		<SidebarHeader :title="$t('rooms.members')" />
		<div class="flex flex-1 flex-col gap-4 overflow-y-auto">
			<div v-if="stewardIds && stewardIds.length > 0" class="pb-4">
				<SideKickSubHeader>
					<div class="flex justify-between">
						<div class="capitalize">{{ $t('rooms.stewards') }}</div>
						<div class="flex items-center gap-2">
							<div>{{ stewardIds.length }}</div>
							<Icon type="user"></Icon>
						</div>
					</div>
				</SideKickSubHeader>
				<div
					v-for="stewardId in stewardIds"
					:key="stewardId"
					class="flex w-full items-center gap-2 rounded-md p-2"
					:class="contextMenuStore.isOpen && contextMenuStore.currentTargetId === stewardId && 'bg-surface-low'"
					v-context-menu="stewardId !== user.user?.userId && !props.disableDM ? (evt: any) => openMenu(evt, [{ label: t('menu.direct_message'), icon: 'chat-circle', onClick: () => startDM(stewardId) }], stewardId) : undefined"
				>
					<Avatar :avatar-url="user.userAvatar(stewardId)" :userId="stewardId" :enableDM="false" class="h-8 w-8 shrink-0"></Avatar>
					<UserDisplayName :userId="stewardId" :user-display-name="user.userDisplayName(stewardId)" :enableDM="false"></UserDisplayName>
				</div>
			</div>

			<div v-if="memberIds && memberIds.length > 0" class="grow">
				<SideKickSubHeader>
					<div class="flex justify-between">
						<div class="capitalize">{{ $t('rooms.members') }}</div>
						<div class="flex items-center gap-2">
							<div>{{ memberIds.length }}</div>
							<Icon type="user"></Icon>
						</div>
					</div>
				</SideKickSubHeader>
				<div
					v-for="memberId in memberIds"
					:key="memberId"
					class="flex w-full items-center gap-2 rounded-md p-2"
					:class="contextMenuStore.isOpen && contextMenuStore.currentTargetId === memberId && 'bg-surface-low'"
					v-context-menu="memberId !== user.user?.userId && !props.disableDM ? (evt: any) => openMenu(evt, [{ label: t('menu.direct_message'), icon: 'chat-circle', onClick: () => startDM(memberId) }], memberId) : undefined"
				>
					<Avatar :avatar-url="user.userAvatar(memberId)" :userId="memberId" :enableDM="false" class="h-8 w-8 shrink-0"></Avatar>
					<UserDisplayName :userId="memberId" :user-display-name="user.userDisplayName(memberId)" :enableDM="false"></UserDisplayName>
				</div>
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
	import SideKickSubHeader from '@hub-client/components/rooms/SideKickSubHeader.vue';
	import UserDisplayName from '@hub-client/components/rooms/UserDisplayName.vue';
	import Avatar from '@hub-client/components/ui/Avatar.vue';
	import SidebarHeader from '@hub-client/components/ui/SidebarHeader.vue';

	// Composables
	import { useDirectMessage } from '@hub-client/composables/useDirectMessage';

	// Models
	import Room from '@hub-client/models/rooms/Room';

	// Store
	import { useUser } from '@hub-client/stores/user';

	// New design
	import { useContextMenu } from '@hub-client/new-design/composables/contextMenu.composable';
	import { useContextMenuStore } from '@hub-client/new-design/stores/contextMenu.store';

	const { t } = useI18n();
	const user = useUser();
	const dm = useDirectMessage();
	const { openMenu } = useContextMenu();
	const contextMenuStore = useContextMenuStore();

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

	function filterMembersByPowerLevel(min: number, max: number) {
		return realMembers.value
			.filter(({ sender }) => {
				const powerLevel = props.room.getStateMemberPowerLevel(sender);
				return powerLevel !== null && powerLevel >= min && powerLevel <= max;
			})
			.map(({ sender }) => sender);
	}

	const stewardIds = computed(() => {
		if (props.room.isDirectMessageRoom()) return [];
		return filterMembersByPowerLevel(50, 99);
	});

	const memberIds = computed(() => {
		// direct messages do not have stewards, only members with powerlevel 100, so show only the members
		if (props.room.isDirectMessageRoom()) {
			return [...new Set(realMembers.value.map((x) => x.sender))]; // Set only stores unique values
		}
		return [...new Set([...filterMembersByPowerLevel(0, 49), ...filterMembersByPowerLevel(100, 100)])]; // only stewards matter as distinction, so the admin is treated as common member
	});

	async function startDM(userId: string) {
		await dm.goToUserDM(userId);
	}
</script>
