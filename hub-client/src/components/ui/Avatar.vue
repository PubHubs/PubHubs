<template>
	<div class="rounded-full w-12 h-12 flex items-center justify-center">
		<img v-if="img != ''" :src="img" :class="rooms.currentRoom === undefined ? 'w-32 h-32 rounded-full border-2 border-blue-500' : 'rounded-full w-full h-full'" />
		<Icon v-else-if="display === '@'" type="person" class="right-0 group-hover:block h-16 w-16"></Icon>
		<span v-else :class="rooms.currentRoom === undefined ? 'text-center text-5xl' : 'text-center text-2xl'">
			{{ display }}
		</span>
	</div>
</template>

<script setup lang="ts">
	import { useRooms } from '@/store/rooms';
	import { computed } from 'vue';
	import filters from '../../core/filters';
	import { useUserName } from '@/composables/useUserName';
	const { getUserDisplayName } = useUserName();

	const rooms = useRooms();

	const props = defineProps({
		userName: {
			type: String,
			default: '',
		},
		img: {
			type: String,
			default: '',
		},
		notMention: {
			type: Boolean,
			default: true,
		},
	});

	const display = computed(() => {
		let name = '' + props.userName; //props.userName;

		if (rooms.currentRoom && props.notMention) {
			const currentRoom = rooms.currentRoom;
			const roomMemberName = getUserDisplayName(props.userName, currentRoom);
			name = filters.matrixDisplayName(roomMemberName);
		}
		if (!name) {
			// IT should not happen, but just in case we should be only the lookout if it happens.
			// Debugging trace to check this.s
			console.trace('`name` argument to `getInitialLetter` not supplied');
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
