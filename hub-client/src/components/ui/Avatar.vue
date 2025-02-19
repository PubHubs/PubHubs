<template>
	<div class="flex aspect-square h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full" :class="avatarColor">
		<img v-if="imageUrl" data-testid="avatar" :src="imageUrl" class="h-full w-full" />
		<Icon v-else size="lg" type="person"></Icon>
	</div>
</template>

<script setup lang="ts">
	import { useUserColor } from '@/composables/useUserColor';
	import RoomMember from '@/model/rooms/RoomMember';
	import { User as MatrixUser } from 'matrix-js-sdk';
	import { CurrentUser, useUser } from '@/store/user';
	import { useMatrixFiles } from '@/composables/useMatrixFiles';
	import { computed, watch, onMounted, ref } from 'vue';

	//Components
	import Icon from '../elements/Icon.vue';
	import { FeatureFlag, useSettings } from '@/store/settings';

	const { color, bgColor } = useUserColor();

	const settings = useSettings();
	const matrixFiles = useMatrixFiles();

	const currentUser = useUser();

	type Props = {
		user: RoomMember | CurrentUser | MatrixUser | null | undefined;
		overrideAvatarUrl?: string | undefined;
	};

	const props = defineProps<Props>();

	const backgroundColor = 'bg-hub-background-4';

	const imageUrl = computed(getImageUrl);
	const avatarColor = computed(getAvatarColor);

	const authMediaUrl = ref<string | undefined>(undefined);

	onMounted(async () => {
		// The nullish coalescing operator (??) to provide a default value of an empty string if overrideAvatarUrl is undefined
		await setAuthenticatedMediaUrl(props.overrideAvatarUrl ?? '');
	});

	watch(
		() => props.overrideAvatarUrl,
		async (newURL) => {
			await setAuthenticatedMediaUrl(newURL ?? '');
		},
	);

	async function setAuthenticatedMediaUrl(matrixURL: string): Promise<void> {
		// If the user has removed the url then authMediaURL should be undefined.
		authMediaUrl.value = matrixURL !== '' ? await matrixFiles.useAuthorizedMediaUrl(matrixURL, settings.isFeatureEnabled(FeatureFlag.authenticatedMedia)) : undefined;
	}

	function getImageUrl(): string | undefined | null {
		if (!props.user) return undefined;
		if (props.overrideAvatarUrl !== undefined) return authMediaUrl.value;
		return userIsCurrentUser() ? currentUser.avatarUrl : props.user.avatarUrl;
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
