<template>
	<div class="bg-surface-subtle relative min-h-full overflow-hidden rounded-md">
		<div class="relative">
			<div class="bg-on-surface-dim absolute top-0 left-0 h-[50%] w-full"></div>
			<div class="relative z-10 flex items-end justify-between px-4 py-4">
				<Avatar :avatar-url="userStore.userAvatar(userId ? userId : event.sender)" :user-id="userId ? userId : event.sender" class="rounded-full object-cover shadow-md ring-2 ring-white ring-offset-1" />
				<div v-if="userStore.userId !== (userId ? userId : event.sender) && props.room?.getPowerLevel(userId ? userId : event.sender) !== 50" class="bg-surface-low mb-2 rounded-md p-[2%]">
					<Button class="bg-on-surface-variant cursor-pointer" @click.once="goToUserRoom(userId ? userId : event.sender)">
						<Icon size="md" type="envelope"></Icon>
					</Button>
				</div>
			</div>
		</div>
		<RoomBadge :user="userId ? userId : event.sender" :room_id="event.room_id"></RoomBadge>
		<div class="px-4 py-1">
			<UserDisplayName :user-id="userId ? userId : event.sender" :userDisplayName="userStore.userDisplayName(userId ? userId : event.sender)" :show-display-name="false" :choose-color="false" />
			<UserDisplayName :user-id="userId ? userId : event.sender" :userDisplayName="userStore.userDisplayName(userId ? userId : event.sender)" :show-pseudonym="false" :choose-color="false" />
		</div>
	</div>
</template>

<script setup lang="ts">
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
	const userStore = useUser();

	const props = defineProps({
		event: {
			type: Object as () => TMessageEvent,
			required: true,
		},
		room: {
			type: Room,
			require: false,
		},
		userId: {
			type: String,
			require: false,
		},
	});

	async function goToUserRoom(userId: string) {
		let userRoom;
		const otherUser = pubhubs.client.getUser(userId);
		if (otherUser) {
			userRoom = await pubhubs.createPrivateRoomWith(otherUser);
			if (userRoom) {
				await pubhubs.routeToRoomPage(userRoom);
			}
		}
	}
</script>
