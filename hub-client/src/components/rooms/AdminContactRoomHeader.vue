<template>
	<div class="flex flex-row gap-2">
		<Avatar
			:avatar-url="undefined"
			:icon="'users'"
		/>
		<div class="flex h-fit flex-col overflow-hidden">
			<p class="truncate leading-tight font-bold">
				{{ props.room.name.startsWith('@') ? $t('admin.support') : props.room.name }}
			</p>
			<p class="text-label-small flex leading-tight">
				{{ props.room.getRoomMembers() }}
				<Icon
					class="mr-1"
					type="user"
				/>
			</p>
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Components
	import Avatar from '@hub-client/components/ui/Avatar.vue';

	// Models
	import Room from '@hub-client/models/rooms/Room';
	import { type TRoomMember } from '@hub-client/models/rooms/TRoomMember';

	// Stores
	import { useUser } from '@hub-client/stores/user';

	const props = defineProps({
		room: {
			type: Room,
			required: true,
		},
		members: {
			type: Array<TRoomMember>,
			required: true,
		},
	});

	const _user = useUser();
</script>
