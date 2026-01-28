<template>
	<div class="flex h-full flex-col gap-4 overflow-y-auto p-3">
		<div v-if="stewardIds && stewardIds.length > 0" class="pb-8">
			<SideKickSubHeader>
				<div class="flex justify-between">
					<div class="capitalize">{{ $t('rooms.stewards') }}</div>
					<div class="flex items-center gap-2">
						<div>{{ stewardIds.length }}</div>
						<Icon type="user"></Icon>
					</div>
				</div>
			</SideKickSubHeader>
			<div v-for="stewardId in stewardIds" :userId="stewardId" :key="stewardId" class="mb-2 flex w-full items-center gap-2">
				<Avatar :avatar-url="user.userAvatar(stewardId)" class="ml-2 h-5 w-5"></Avatar>
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
			<div v-for="memberId in memberIds" :userId="memberId" :key="memberId" class="mb-2 flex w-full items-center gap-2">
				<Avatar :avatar-url="user.userAvatar(memberId)" class="ml-2 h-5 w-5"></Avatar>
				<UserDisplayName :userId="memberId" :user-display-name="user.userDisplayName(memberId)"></UserDisplayName>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { onMounted, ref, watch } from 'vue';
	import { useRoute } from 'vue-router';

	// Components
	import SideKickSubHeader from '@hub-client/components/rooms/SideKickSubHeader.vue';
	import UserDisplayName from '@hub-client/components/rooms/UserDisplayName.vue';
	import Avatar from '@hub-client/components/ui/Avatar.vue';

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
		if (props.room.directMessageRoom()) {
			memberIds.value = [...new Set(realMembers.map((x) => x.sender))]; // Set only stores unique values
		} else {
			stewardIds.value = filterMembersByPowerLevel(50, 99);
			memberIds.value = [...new Set([...filterMembersByPowerLevel(0, 49), ...filterMembersByPowerLevel(100, 100)])]; // only steards matter as distinction, so the admin is treated as common member
		}
	}
</script>
