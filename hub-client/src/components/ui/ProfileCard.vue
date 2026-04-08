<template>
	<div class="bg-surface-subtle rounded-base relative min-h-full overflow-hidden">
		<div class="relative">
			<div class="bg-on-surface-dim absolute top-0 left-0 h-[50%] w-full" />
			<div class="relative z-10 flex items-end justify-between px-4 py-4">
				<Avatar
					:avatar-url="userStore.userAvatar(userId ? userId : event.sender)"
					class="rounded-full object-cover shadow-md ring-2 ring-white ring-offset-1"
					:user-id="userId ? userId : event.sender"
				/>
				<div
					v-if="userStore.userId !== (userId ? userId : event.sender) && props.room?.getPowerLevel(userId ? userId : event.sender) !== 50"
					class="bg-surface-low mb-2 rounded-md p-[2%]"
				>
					<Button
						class="bg-on-surface-variant cursor-pointer"
						@click.once="userStore.goToUserRoom(userId ? userId : event.sender)"
					>
						<Icon
							size="md"
							type="envelope"
						/>
					</Button>
				</div>
			</div>
		</div>
		<RoomBadge
			:room-id="event.room_id"
			:user="userId ? userId : event.sender"
		/>
		<div class="px-4 py-1">
			<UserDisplayName
				:choose-color="false"
				:show-display-name="false"
				:user-display-name="userStore.userDisplayName(userId ? userId : event.sender)"
				:user-id="userId ? userId : event.sender"
			/>
			<UserDisplayName
				:choose-color="false"
				:show-pseudonym="false"
				:user-display-name="userStore.userDisplayName(userId ? userId : event.sender)"
				:user-id="userId ? userId : event.sender"
			/>
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import RoomBadge from '@hub-client/components/rooms/RoomBadge.vue';
	import UserDisplayName from '@hub-client/components/rooms/UserDisplayName.vue';
	import Avatar from '@hub-client/components/ui/Avatar.vue';

	// Models
	import { type TMessageEvent } from '@hub-client/models/events/TMessageEvent';
	import Room from '@hub-client/models/rooms/Room';

	// Stores
	import { useUser } from '@hub-client/stores/user';

	const props = defineProps({
		event: {
			type: Object as () => TMessageEvent,
			required: true,
		},
		room: {
			type: Room,
			require: false,
			default: undefined,
		},
		userId: {
			type: String,
			require: false,
			default: undefined,
		},
	});

	const userStore = useUser();
</script>
