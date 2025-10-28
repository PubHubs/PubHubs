<template>
	<RoomSideKick @close="close()" :title="$t('rooms.memberlist')">
		<div v-if="stewardIds" class="h-full flex-1">
			<SideKickSubHeader>
				<div class="flex justify-between">
					<div class="capitalize">{{ $t('rooms.stewards') }}</div>
					<div class="flex">
						<div>{{ stewardIds.length }}</div>
						<Icon type="user" size="sm" class="mt-1"></Icon>
					</div>
				</div>
			</SideKickSubHeader>
			<div v-for="stewardId in stewardIds" :userId="stewardId" :key="stewardId" class="mb-2 flex w-full gap-2">
				<Avatar :avatar-url="user.userAvatar(stewardId)" class="ml-2 h-6 w-6"></Avatar>
				<UserDisplayName :userId="stewardId" :user-display-name="user.userDisplayName(stewardId)"></UserDisplayName>
			</div>
		</div>

		<div v-if="memberIds" class="h-full flex-1">
			<SideKickSubHeader>
				<div class="flex justify-between">
					<div class="capitalize">{{ $t('rooms.members') }}</div>
					<div class="flex">
						<div>{{ memberIds.length }}</div>
						<Icon type="user" size="sm" class="mt-1"></Icon>
					</div>
				</div>
			</SideKickSubHeader>
			<div v-for="memberId in memberIds" :userId="memberId" :key="memberId" class="mb-2 flex w-full gap-2">
				<Avatar :avatar-url="user.userAvatar(memberId)" class="ml-2 h-6 w-6"></Avatar>
				<UserDisplayName :userId="memberId" :user-display-name="user.userDisplayName(memberId)"></UserDisplayName>
			</div>
		</div>
	</RoomSideKick>
</template>

<script setup lang="ts">
	// Packages
	import { onMounted, ref, watch } from 'vue';
	import { useRoute } from 'vue-router';

	// Components
	import RoomSideKick from '@hub-client/components/rooms/RoomSideKick.vue';
	import SideKickSubHeader from '@hub-client/components/rooms/SideKickSubHeader.vue';
	import UserDisplayName from '@hub-client/components/rooms/UserDisplayName.vue';
	import Avatar from '@hub-client/components/ui/Avatar.vue';

	// Models
	import Room from '@hub-client/models/rooms/Room';

	// Store
	import { useUser } from '@hub-client/stores/user';

	const route = useRoute();
	const user = useUser();

	const emit = defineEmits(['close']);

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
			memberIds.value = filterMembersByPowerLevel(0, 49);
		}
	}

	function close() {
		emit('close');
	}
</script>
