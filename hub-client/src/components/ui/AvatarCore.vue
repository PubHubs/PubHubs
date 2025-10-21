<template>
	<div class="flex aspect-square h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full" :class="avatarColor">
		<img v-if="img" v-show="loaded" data-testid="avatar" :src="image" class="h-full w-full" @load="imgLoaded()" />
		<Icon v-if="!img || !loaded" size="lg" type="user" testid="avatar" />
	</div>
</template>

<script setup lang="ts">
	/**
	 * This Avatar is used when you need to show a specific image, use cases:
	 * - In case of previewing a (new) avatar
	 * - For Room avatars
	 * - Also uses by AvatarUser & AvatarUserId
	 */

	import { ref, onMounted, watch, computed } from 'vue';
	import { useUserColor } from '@/logic/composables/useUserColor';
	import { useMatrixFiles } from '@/logic/composables/useMatrixFiles';
	import { FeatureFlag, useSettings } from '@/logic/store/settings';

	//Components
	import Icon from '../elements/Icon.vue';

	const { isMxcUrl, useAuthorizedMediaUrl } = useMatrixFiles();
	const { color, bgColor } = useUserColor();

	type Props = {
		img: string | undefined;
		user?: any;
	};

	const props = withDefaults(defineProps<Props>(), { user: undefined, icon: 'person' });

	const image = ref<string | undefined>();
	const loaded = ref(false);
	const avatarColor = computed(getAvatarColor);

	onMounted(async () => {
		await getImage();
	});

	watch(props, async () => {
		await getImage();
	});

	async function getImage() {
		let url = props.img as string;
		if (props.img) {
			if (isMxcUrl(props.img)) {
				const settings = useSettings();
				url = await useAuthorizedMediaUrl(props.img, settings.isFeatureEnabled(FeatureFlag.authenticatedMedia));
			}
		}
		image.value = url;
	}

	function getAvatarColor(): string {
		const backgroundColor = 'bg-surface-high';
		if (!props.user?.userId && !props.user?.name) return backgroundColor;
		if (!props.user?.userId && props.user?.name) return bgColor(color(props.user.name));
		return bgColor(color(props.user.userId));
	}

	function imgLoaded() {
		loaded.value = true;
	}
</script>
