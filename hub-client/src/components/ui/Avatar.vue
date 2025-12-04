<template>
	<div class="flex aspect-square h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full" :class="avatarColor">
		<img v-if="avatarUrl" v-show="loaded" data-testid="avatar" :src="image" class="h-full w-full" @load="imgLoaded()" />
		<Icon v-if="!avatarUrl || !loaded" size="lg" :type="icon ? icon : 'user'" testid="avatar" />
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed, onMounted, ref, watch } from 'vue';

	// Composables
	import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';
	import { useUserColor } from '@hub-client/composables/useUserColor';

	// Stores
	import { FeatureFlag, useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	// Types
	type Props = {
		avatarUrl: string | undefined;
		userId?: string;
		icon?: string;
	};

	const user = useUser();
	const { color, bgColor } = useUserColor();
	const { isMxcUrl, useAuthorizedMediaUrl } = useMatrixFiles();
	const image = ref<string | undefined>();
	const loaded = ref(false);
	const avatarColor = computed(getAvatarColor);
	const props = defineProps<Props>();

	onMounted(async () => {
		await getImage();
	});

	watch(props, async () => {
		await getImage();
	});

	async function getImage() {
		let url = props.avatarUrl as string;
		if (props.avatarUrl) {
			if (isMxcUrl(props.avatarUrl)) {
				const settings = useSettings();
				url = await useAuthorizedMediaUrl(props.avatarUrl, settings.isFeatureEnabled(FeatureFlag.authenticatedMedia));
			}
		}
		image.value = url;
	}

	function getAvatarColor(): string {
		if (!props.userId) return 'bg-surface-high';
		const currentUser = user.client.getUser(props.userId);

		if (!props.userId && !currentUser?.displayName) return 'bg-surface-high';
		if (!props.userId && currentUser?.displayName) return bgColor(color(props.userId));

		return bgColor(color(props.userId));
	}

	function imgLoaded() {
		loaded.value = true;
	}
</script>
