<template>
	<RoomSideKick @close="close()" :title="$t('rooms.memberlist')">
		<div v-if="hasStewards" class="h-full flex-1">
			<SideKickSubHeader>
				<div class="flex justify-between">
					<div class="capitalize">{{ $t('rooms.stewards') }}</div>
					<div class="flex items-center gap-2">
						<div>{{ stewards.length }}</div>
						<Icon type="user"></Icon>
					</div>
				</div>
			</SideKickSubHeader>
			<div v-for="steward in stewards" :userId="steward?.userId" :key="steward?.userId" class="mb-2 flex w-full gap-2">
				<Avatar :userId="steward.userId" class="ml-2 h-6 w-6"></Avatar>
				<UserDisplayName :user="steward.userId" :room="room"></UserDisplayName>
			</div>
		</div>

		<div v-if="hasMembers" class="h-full flex-1">
			<SideKickSubHeader>
				<div class="flex justify-between">
					<div class="capitalize">{{ $t('rooms.members') }}</div>
					<div class="flex items-center gap-2">
						<div>{{ members.length }}</div>
						<Icon type="user"></Icon>
					</div>
				</div>
			</SideKickSubHeader>
			<div v-for="member in members" :userId="member?.userId" :key="member?.userId" class="mb-2 flex w-full gap-2">
				<Avatar :userId="member.userId" class="ml-2 h-6 w-6"></Avatar>
				<UserDisplayName :user="member.userId" :room="room"></UserDisplayName>
			</div>
		</div>
	</RoomSideKick>
</template>

<script setup lang="ts">
	import { onMounted, ref, computed, watch } from 'vue';
	import { useRoute } from 'vue-router';

	import Room from '@/model/rooms/Room';
	import Avatar from '../ui/Avatar.vue';
	import UserDisplayName from './UserDisplayName.vue';
	import RoomSideKick from './RoomSideKick.vue';
	import SideKickSubHeader from './SideKickSubHeader.vue';

	const route = useRoute();
	const emit = defineEmits(['close']);

	const props = defineProps({
		room: {
			type: Room,
			required: true,
		},
	});

	const stewards = ref();
	const members = ref();

	onMounted(() => {
		loadMembers();
	});

	watch(route, () => {
		loadMembers();
	});

	function loadMembers() {
		const memberIds = props.room.getMembersIds();

		const fullMembers = memberIds.map((member) => props.room.getMember(member, true)).filter((fullMember) => fullMember.matrixRoomMember.membership === 'join' || fullMember.matrixRoomMember.membership === 'invite');
		const membersSortedByName = fullMembers.sort((a, b) => {
			if (a === null && b === null) {
				return 0;
			} else {
				return (a!.name.toLowerCase() > b!.name.toLowerCase()) as unknown as number;
			}
		});

		members.value = membersSortedByName;
		stewards.value = members.value.filter((member: { matrixRoomMember: { powerLevel: number } }) => member.matrixRoomMember.powerLevel >= 50 && member.matrixRoomMember.powerLevel < 100);
		if (stewards.value.length > 0) {
			members.value = members.value.filter((member: { matrixRoomMember: { powerLevel: number } }) => member.matrixRoomMember.powerLevel < 50 || member.matrixRoomMember.powerLevel >= 100);
		}
	}

	const hasMembers = computed(() => {
		return members.value;
	});

	const hasStewards = computed(() => {
		return stewards.value;
	});

	function close() {
		emit('close');
	}
</script>
