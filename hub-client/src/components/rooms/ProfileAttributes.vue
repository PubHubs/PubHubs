<template>
	<span
		v-if="roomAttributes.length > 0"
		class="flex w-full items-center gap-x-1"
	>
		<span
			v-for="value in roomAttributes"
			:key="value"
			class="text-background text-label-small flex w-fit items-center gap-1 rounded-full px-2 lowercase"
			:class="value === 'admin.title_administrator' ? 'bg-accent-primary' : 'bg-surface text-on-surface-variant'"
		>
			<Icon
				class="py-1"
				:class="value === 'admin.title_administrator' ? 'text-background' : 'text-on-surface-variant'"
				size="xs"
				type="check-circle"
			/>
			<span
				v-if="value === 'admin.title_administrator'"
				class="line-clamp-1"
				>{{ $t(value) }}</span
			>
			<span
				v-else
				class="line-clamp-1"
				>{{ value }}</span
			>
		</span>
	</span>
</template>

<script lang="ts" setup>
	// Packages
	import { ref, watch } from 'vue';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';

	// Stores
	import { useRooms } from '@hub-client/stores/rooms';

	// Types
	interface Props {
		user: string;
		roomId: string;
	}

	const props = defineProps<Props>();
	const rooms = useRooms();
	const roomAttributes = ref<string[]>([]);

	function update_attributes() {
		if (rooms.roomNotices[props.roomId] && rooms.roomNotices[props.roomId][props.user]) {
			roomAttributes.value = rooms.roomNotices[props.roomId][props.user];
		}
	}

	update_attributes();

	watch(
		() => rooms.roomNotices[props.roomId],
		() => {
			update_attributes();
		},
		{ deep: true },
	);
</script>
