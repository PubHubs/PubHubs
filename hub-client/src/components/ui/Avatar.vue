<template>
	<div class="rounded-full w-12 h-12 flex items-center justify-center overflow-hidden" :class="bgColor(color(userId))">
		<!-- If image is passed as props then render the image on Avatar-->
		<img v-if="image !== ''" :src="image" class="rounded-full w-full h-full" />
		<!-- Otherwise  show  icon -->
		<Icon v-else type="person" class="right-0 group-hover:block h-16 w-16"></Icon>
	</div>
</template>

<script setup lang="ts">
	import { Room, useRooms } from '@/store/rooms';
	import { computed } from 'vue';
	import { useUser } from '@/store/store';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { useUserColor } from '@/composables/useUserColor';
	import { useUserAvatar } from '@/composables/useUserName';
	const { color, bgColor } = useUserColor();
	const rooms = useRooms();
	const pubhubs = usePubHubs();

	/* Props 
		userId: It is used to set the avatar for the current user
		img: It is used when the avatar is changed from hub settings.
	*/

	type Props = {
		userId: string;
		img?: string;
	};

	const props = withDefaults(defineProps<Props>(), {
		img: '',
	});

	const avatar = computed(() => {
		const currentRoom = rooms.currentRoom;
		if (currentRoom) {
			const { getUserAvatar } = useUserAvatar();
			return getUserAvatar(props.userId, rooms.currentRoom as Room);
		}
		return null;
	});

	// If the img is changed, then it should update the avatar, otherwise check computed avatar
	const image = computed(() => {
		const user = useUser();
		const isCurrentUser = user.user.userId === props.userId;
		const hasCustomImage = props.img !== undefined && props.img !== '';

		if (isCurrentUser && hasCustomImage) {
			return props.img;
		}

		if (isCurrentUser && !hasCustomImage) {
			return '';
		}

		// Fetch all avatar
		return avatar.value ? pubhubs.getBaseUrl + '/_matrix/media/r0/download/' + avatar.value.slice(6) : '';
	});
</script>
