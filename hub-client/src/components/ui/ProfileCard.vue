<template>
	<div class="relative min-h-full overflow-hidden rounded-md bg-surface-subtle">
		<div class="relative">
			<div class="absolute left-0 top-0 h-[50%] w-full bg-on-surface-dim"></div>
			<div class="relative z-10 flex items-end justify-between px-4 py-4">
				<Avatar :userId="event.sender" class="rounded-full object-cover shadow-md ring-2 ring-white ring-offset-1" />
				<div v-if="user.user.userId !== event.sender && props.room?.getPowerLevel(event.sender) !== 50" class="mb-2 rounded-md bg-surface-low p-[2%]">
					<Icon type="envelope" @click="goToUserRoom(event.sender)" class="cursor-pointer"></Icon>
				</div>
			</div>
		</div>

		<RoomBadge :user="event.sender" :room_id="event.room_id"></RoomBadge>
		<div class="px-4 py-1">
			<UserDisplayName :user="event.sender" :room="room" :show-display-name="false" :choose-color="false" />
			<UserDisplayName :user="event.sender" :room="room" :show-pseudonym="false" :choose-color="false" />
		</div>
	</div>
</template>

<script setup lang="ts">
	import RoomBadge from '../rooms/RoomBadge.vue';
	import UserDisplayName from '../rooms/UserDisplayName.vue';
	import Avatar from './Avatar.vue';
	import Icon from '../elements/Icon.vue';

	import { TMessageEvent } from '@/model/events/TMessageEvent';
	import RoomMember from '@/model/rooms/RoomMember';
	import Room from '@/model/rooms/Room';

	import { usePubHubs } from '@/logic/core/pubhubsStore';
	import { useUser } from '@/logic/store/user';

	const pubhubs = usePubHubs();

	const user = useUser();

	const props = defineProps({
		roomMember: {
			type: RoomMember,
			required: true,
		},
		event: {
			type: Object as () => TMessageEvent,
			required: true,
		},
		room: {
			type: Room,
			require: true,
		},
	});

	async function goToUserRoom(userId: string) {
		let room;
		const other = pubhubs.client.getUser(userId);
		room = await pubhubs.createPrivateRoomWith(other);

		if (room) {
			await pubhubs.routeToRoomPage(room);
		}
	}
</script>
