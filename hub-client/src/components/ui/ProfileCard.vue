<template>
	<div class="bg-surface-subtle relative min-h-full overflow-hidden rounded-md">
		<div class="relative">
			<div class="bg-on-surface-dim absolute top-0 left-0 h-[50%] w-full"></div>
			<div class="relative z-10 flex items-end justify-between px-4 py-4">
				<Avatar :avatar-url="user.userAvatar(event.sender)" :user-id="event.sender" class="rounded-full object-cover shadow-md ring-2 ring-white ring-offset-1" />
				<div v-if="user.userId !== event.sender && props.room?.getPowerLevel(event.sender) !== 50" class="bg-surface-low mb-2 rounded-md p-[2%]">
					<Icon type="envelope" @click.stop="goToUserRoom(event.sender)" class="cursor-pointer"></Icon>
				</div>
			</div>
		</div>

		<RoomBadge :user="event.sender" :room_id="event.room_id"></RoomBadge>
		<div class="px-4 py-1">
			<UserDisplayName :user-id="event.sender" :userDisplayName="user.userDisplayName(event.sender)" :show-display-name="false" :choose-color="false" />
			<UserDisplayName :user-id="event.sender" :userDisplayName="user.userDisplayName(event.sender)" :show-pseudonym="false" :choose-color="false" />
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { RoomMember } from 'matrix-js-sdk';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import RoomBadge from '@hub-client/components/rooms/RoomBadge.vue';
	import UserDisplayName from '@hub-client/components/rooms/UserDisplayName.vue';
	import Avatar from '@hub-client/components/ui/Avatar.vue';

	// Models
	import { TMessageEvent } from '@hub-client/models/events/TMessageEvent';
	import Room from '@hub-client/models/rooms/Room';

	// Stores
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useUser } from '@hub-client/stores/user';

	const pubhubs = usePubhubsStore();
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
		if (other) {
			room = await pubhubs.createPrivateRoomWith(other);
			if (room) {
				await pubhubs.routeToRoomPage(room);
			}
		}
	}
</script>
