<template>
	<div class="flex flex-row gap-2">
		<Avatar
			:avatar-url="avatarOverrideUrl"
			icon="two_users"
		/>

		<div class="flex h-fit flex-col overflow-hidden">
			<p class="truncate leading-tight font-bold">
				{{ props.room.name }}
			</p>

			<p class="text-label-small flex leading-tight">
				{{ props.room.getRoomMembers() }}
				<Icon
					class="mr-1"
					size="sm"
					type="user"
				/>

				<span class="mx-1">
					{{ user.user.displayName }}
					<span v-if="memberList.length > 0">,</span>
				</span>

				<span
					v-for="(member, index) in memberList"
					:key="member.userId"
					class="mx-1 truncate"
				>
					{{ member.rawDisplayName }}
					<span v-if="index < memberList.length - 1">,</span>
				</span>
			</p>
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { computed, ref, watch } from 'vue';

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
	const user = useUser();
	const avatarOverrideUrl = ref<string | undefined>(undefined);

	watch(
		() => props.room,
		async (room) => {
			if (!room) {
				avatarOverrideUrl.value = undefined;
				return;
			}
			avatarOverrideUrl.value = await props.room.getRoomAvatarAuthorizedUrl();
		},
		{ immediate: true },
	);

	// All members except current user
	const memberList = computed(() => props.members.filter((m) => m.userId !== user.userId));
</script>
