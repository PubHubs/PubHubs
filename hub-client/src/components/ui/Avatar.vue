<template>
	<div class="rounded-full w-12 h-12 shrink-0 aspect-square flex items-center justify-center overflow-hidden" :class="avatarColor">
		<img v-if="imageUrl" data-testid="avatar" :src="imageUrl" class="w-full h-full" />
		<Icon v-else size="lg" type="person"></Icon>
	</div>
</template>

<script setup lang="ts">
	import { useUserColor } from '@/composables/useUserColor';
	import RoomMember from '@/model/rooms/RoomMember';
	import { CurrentUser, useUser } from '@/store/user';
	import { computed } from 'vue';

	//Components
	import Icon from '../elements/Icon.vue';

	const { color, bgColor } = useUserColor();

	const currentUser = useUser();

	type Props = {
		user: RoomMember | CurrentUser | null | undefined;
		overrideAvatarUrl?: string | undefined;
	};

	const props = defineProps<Props>();

	const backgroundColor = 'bg-hub-background-4';

	const imageUrl = computed(getImageUrl);
	const avatarColor = computed(getAvatarColor);

	function getImageUrl(): string | undefined | null {
		if (!props.user) {
			return undefined;
		} else if (props.overrideAvatarUrl !== undefined) {
			return props.overrideAvatarUrl;
		} else if (userIsCurrentUser()) {
			return currentUser.avatarUrl;
		} else {
			return props.user.avatarUrl;
		}
	}

	function getAvatarColor(): string {
		if (!props.user?.userId) return backgroundColor;

		if (imageUrl.value) {
			return backgroundColor;
		} else {
			return bgColor(color(props.user.userId));
		}
	}

	function userIsCurrentUser(): boolean {
		return props.user?.userId === currentUser.userId;
	}
</script>
