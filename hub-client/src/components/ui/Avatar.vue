<template>
	<div
		class="flex aspect-square h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full"
		:class="avatarColor"
	>
		<img
			v-if="avatarUrl"
			v-show="loaded"
			class="h-full w-full"
			data-testid="avatar"
			:src="image"
			@load="imgLoaded()"
		/>
		<Icon
			v-if="!avatarUrl || !loaded"
			:class="iconColor"
			size="lg"
			testid="avatar"
			:type="icon ? icon : 'user'"
		/>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { computed, onMounted, ref, watch } from 'vue';

	import Icon from '@hub-client/components/elements/Icon.vue';

	// Composables
	import { useUserColor } from '@hub-client/composables/useUserColor';

	// Stores
	import { useUser } from '@hub-client/stores/user';

	// Types
	type Props = {
		avatarUrl: string | undefined;
		userId?: string;
		icon?: string;
	};

	const props = defineProps<Props>();
	const user = useUser();
	const { color, bgColor, onAccentColor } = useUserColor();
	const image = ref<string | undefined>();
	const loaded = ref(false);
	const avatarColor = computed(getAvatarColor);
	const iconColor = computed(() => (props.userId ? onAccentColor(color(props.userId)) : 'text-on-surface'));
	onMounted(async () => {
		await getImage();
	});

	watch(props, async () => {
		await getImage();
	});

	async function getImage() {
		image.value = props.avatarUrl;
	}

	function getAvatarColor(): string {
		if (!props.userId) return 'bg-surface-high';

		if (!props.userId && !user.displayName) return 'bg-surface-high';
		if (!props.userId && user.displayName) return bgColor(color(props.userId));

		return bgColor(color(props.userId));
	}

	function imgLoaded() {
		loaded.value = true;
	}
</script>
