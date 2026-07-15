<template>
	<div
		class="flex aspect-square h-600 w-600 shrink-0 items-center justify-center overflow-clip rounded-full"
		:class="[avatarColor, stewardRing]"
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
	import { useRooms } from '@hub-client/stores/rooms';
	import { useUser } from '@hub-client/stores/user';

	// Types
	type Props = {
		avatarUrl: string | undefined;
		userId?: string;
		icon?: string;
		roomId?: string;
	};

	const props = defineProps<Props>();
	const user = useUser();
	const rooms = useRooms();
	const { color, bgColor, onAccentColor } = useUserColor();
	const image = ref<string | undefined>();
	const loaded = ref(false);
	const avatarColor = computed(getAvatarColor);
	const stewardRing = computed(() => {
		if (!props.roomId || !props.userId) return '';
		const room = rooms.room(props.roomId);
		if (!room) return '';
		if (room.isDirectMessageRoom()) return '';
		return room.getPowerLevel(props.userId) >= 50 ? 'ring-2 ring-accent-steward/75' : '';
	});
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
		if (!props.userId) return 'bg-surface-base';

		if (!props.userId && !user.displayName) return 'bg-surface-base';
		if (!props.userId && user.displayName) return bgColor(color(props.userId));

		return bgColor(color(props.userId));
	}

	function imgLoaded() {
		loaded.value = true;
	}
</script>
