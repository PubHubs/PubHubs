<template>
	<div class="rounded-full w-12 h-12 flex items-center justify-center overflow-hidden" :class="bgColor(color(userId))">
		<!-- If image is passed as props then render the image on Avatar-->
		<img v-if="image !== ''" :src="image" class="rounded-full w-full h-full" />
		<!-- Otherwise  show  icon -->
		<Icon v-else-if="icon" type="person" class="right-0 group-hover:block h-16 w-16"></Icon>
	</div>
</template>

<script setup lang="ts">
	/*
	Windows Edge browser corner case might not work: Upload Avatar and then do a browser refresh, new avatar is not updated
	*/

	import { Room, useRooms } from '@/store/rooms';
	import { computed } from 'vue';
	import { useUser } from '@/store/store';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { useUserColor } from '@/composables/useUserColor';
	import { useUserAvatar } from '@/composables/useUserName';
	const { color, bgColor } = useUserColor();
	const rooms = useRooms();
	const pubhubs = usePubHubs();

	type Props = {
		userId: string;
		img?: string;
		fromHubSettings: boolean;
		icon?: boolean;
	};

	const props = withDefaults(defineProps<Props>(), {
		img: '',
		fromHubSettings: false,
		icon: false,
	});

	// Compute avatar whenever img props is ''.
	const avatar = computed(() => {
		const currentRoom = rooms.currentRoom;
		if (currentRoom) {
			const { getUserAvatar } = useUserAvatar();
			return getUserAvatar(props.userId, rooms.currentRoom as Room);
		} else {
			const user = useUser();
			if (user.user.userId === props.userId) {
				return user.user.avatarUrl;
			}
		}
		return null;
	});

	// If the img is changed, then it should update the avatar
	const image = computed(() => {
		// When avatar is set from dialogbox hub settings.
		if (props.img) return props.img;

		// If the avatar from the HubSetting is removed, then props.img is set to empty string.
		// In that case, icon of user is shown.
		if (props.fromHubSettings && props.img === '') return '';

		// Fetches the avatar when pubhubs app is opened.
		return avatar.value ? pubhubs.getBaseUrl + '/_matrix/media/r0/download/' + avatar.value.slice(6) : '';
	});
</script>
