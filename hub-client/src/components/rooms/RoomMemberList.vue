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
				<div v-for="stewardId in stewardIds" :userId="stewardId" :key="stewardId" class="flex w-full items-center gap-2 rounded-md p-2">
					<Avatar :avatar-url="user.userAvatar(stewardId)" class="h-8 w-8 shrink-0"></Avatar>
					<UserDisplayName :userId="stewardId" :user-display-name="user.userDisplayName(stewardId)"></UserDisplayName>
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
				<div v-for="memberId in memberIds" :userId="memberId" :key="memberId" class="flex w-full items-center gap-2 rounded-md p-2">
					<Avatar :avatar-url="user.userAvatar(memberId)" class="h-8 w-8 shrink-0"></Avatar>
					<UserDisplayName :userId="memberId" :user-display-name="user.userDisplayName(memberId)"></UserDisplayName>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { onMounted, ref, watch } from 'vue';
	import { useRoute } from 'vue-router';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import SideKickSubHeader from '@hub-client/components/rooms/SideKickSubHeader.vue';
	import UserDisplayName from '@hub-client/components/rooms/UserDisplayName.vue';
	import Avatar from '@hub-client/components/ui/Avatar.vue';
	import SidebarHeader from '@hub-client/components/ui/SidebarHeader.vue';

	// Models
	import Room from '@hub-client/models/rooms/Room';

	// Store
	import { useUser } from '@hub-client/stores/user';

	const route = useRoute();
	const user = useUser();

	const props = defineProps({
		room: {
			type: Room,
			required: true,
		},
	});

	const stewardIds = ref();
	const memberIds = ref();

	onMounted(() => {
		loadMembers();
	});

	watch(route, () => {
		loadMembers();
	});

	function loadMembers() {
		const joinedMembers = props.room.getStateJoinedMembers();

		const realMembers = joinedMembers.filter((m) => !m.state_key.startsWith('@notices_user:'));

		const filterMembersByPowerLevel = (min: number, max: number) =>
			realMembers
				.filter(({ sender }) => {
					const powerLevel = props.room.getStateMemberPowerLevel(sender);
					return powerLevel !== null && powerLevel >= min && powerLevel <= max;
				})
				.map(({ sender }) => sender);

		// direct messages do not have stewards, only members with powerlevel 100, so show only the members
		if (props.room.isDirectMessageRoom()) {
			memberIds.value = [...new Set(realMembers.map((x) => x.sender))]; // Set only stores unique values
		} else {
			stewardIds.value = filterMembersByPowerLevel(50, 99);
			memberIds.value = [...new Set([...filterMembersByPowerLevel(0, 49), ...filterMembersByPowerLevel(100, 100)])]; // only steards matter as distinction, so the admin is treated as common member
		}
	}
</script>
