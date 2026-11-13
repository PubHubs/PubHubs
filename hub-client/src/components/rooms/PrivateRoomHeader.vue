<template>
	<div class="flex flex-row gap-100">
		<Avatar
			:avatar-url="user.userAvatar(otherUser?.userId ?? '')"
			icon="users"
			:user-id="otherUser?.userId ?? ''"
		/>
		<div class="flex h-fit flex-col overflow-hidden">
			<p class="truncate leading-tight font-bold">
				<MemberName
					:raw-display-name="otherUser?.rawDisplayName"
					:user-id="otherUser?.userId ?? ''"
				/>
			</p>
			<p class="text-label-small leading-tight">
				{{ pseudonym }}
			</p>
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { computed } from 'vue';

	// Components
	import MemberName from '@hub-client/components/rooms/MemberName.vue';
	import Avatar from '@hub-client/components/ui/Avatar.vue';

	// Logic
	import filters from '@hub-client/logic/core/filters';

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

	const user = useUser();

	const otherUser = computed(() => props.members.findLast((member) => member.userId !== user.userId) ?? null);

	// A deleted account is shown under neither its name nor its pseudonym; `MemberName` takes
	// care of the name, this of the line below it.
	const pseudonym = computed(() => {
		const userId = otherUser.value?.userId;
		if (!userId || user.isDeactivatedUser(userId)) return '';
		return filters.extractPseudonym(userId);
	});
</script>
