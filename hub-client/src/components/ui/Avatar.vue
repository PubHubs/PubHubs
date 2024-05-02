<template>
	<div class="rounded-full w-12 h-12 flex items-center justify-center overflow-hidden" :class="bgColor(color(userId))">
		<img v-if="image != ''" :src="image" class="rounded-full w-full h-full" />
		<Icon v-else-if="display === '@'" type="person" class="right-0 group-hover:block h-16 w-16"></Icon>
		<span v-else :class="rooms.currentRoom === undefined ? 'text-center text-5xl' : 'text-center text-2xl'">
			{{ display }}
		</span>
	</div>
</template>

<script setup lang="ts">
	import { Room, useRooms } from '@/store/rooms';
	import { computed } from 'vue';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { useUserColor } from '@/composables/useUserColor';
	import { useUserName } from '@/composables/useUserName';
	import { useUserAvatar } from '@/composables/useUserName';
	const { color, bgColor } = useUserColor();
	const { getUserDisplayName } = useUserName();
	const rooms = useRooms();
	const pubhubs = usePubHubs();

	type Props = {
		userId: string;
		img?: string;
		notMention?: boolean;
	};

	const props = withDefaults(defineProps<Props>(), {
		img: '',
		notMention: false,
	});

	const avatar = computed(() => {
		const currentRoom = rooms.currentRoom;
		if (currentRoom) {
			const { getUserAvatar } = useUserAvatar();
			return getUserAvatar(props.userId, rooms.currentRoom as Room);
		}
		return null;
	});

	const image = computed(() => {
		if (props.img) {
			return props.img;
		}
		return avatar.value ? pubhubs.getBaseUrl + '/_matrix/media/r0/download/' + avatar.value.slice(6) : '';
	});

	const display = computed(() => {
		let name = '' + props.userId;

		if (rooms.currentRoom && !props.notMention) {
			const currentRoom = rooms.currentRoom;
			name = getUserDisplayName(props.userId, currentRoom);
		}
		if (!name) {
			// IT should not happen, but just in case we should be only the lookout if it happens.
			// Debugging trace to check this.s
			console.trace('`name` argument to `getInitialLetter` not supplied', name, props.userId);
			return undefined;
		}
		if (name.length < 1) {
			return undefined;
		}

		const initial = name[0];
		if ((initial === '@' || initial === '#' || initial === '+') && name[1]) {
			name = '@';
		} else {
			name = initial;
		}

		return name.toUpperCase();
	});
</script>
