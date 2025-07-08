<template>
	<div class="flex flex-row gap-2">
		<Avatar :userId="otherUser?.userId" />
		<div class="flex h-fit flex-col overflow-hidden">
			<p class="truncate font-bold leading-tight">
				{{ otherUser?.rawDisplayName ?? '' }}
			</p>
			<p class="leading-tight ~text-label-small-min/label-small-max">
				{{ otherUser?.userId ? filters.extractPseudonym(otherUser.userId) : '' }}
			</p>
		</div>
	</div>
</template>

<script setup lang="ts">
	import Avatar from '../ui/Avatar.vue';
	import { useUser } from '@/logic/store/user';
	import Room from '@/model/rooms/Room';
	import { computed } from 'vue';
	import { TRoomMember } from '@/model/rooms/TRoomMember';
	import filters from '@/logic/core/filters';

	const user = useUser();

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

	const otherUser = computed(() => props.members.findLast((member) => member.userId !== user.user.userId) ?? null);
</script>
