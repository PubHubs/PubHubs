<template>
	<span
		class="inline-flex max-h-300 w-full items-center justify-start gap-2 truncate overflow-hidden"
		:title="label"
	>
		<Avatar
			v-if="avatar || avatar == ''"
			:avatar-url="avatar"
			class="h-300 w-300"
			:user-id="typeof value !== 'string' ? (value.value ?? '') : ''"
		/>
		<span
			v-if="icon"
			class="mr-075 h-100 w-100"
		>
			<Icon
				class="-mt-050"
				size="sm"
				:type="icon"
			/>
		</span>
		<span class="text-surface-on-surface justify-start truncate text-nowrap text-ellipsis">{{ label }}</span>
	</span>
</template>

<script lang="ts" setup>
	import { computed } from 'vue';

	// Components
	import Avatar from '@hub-client/components/ui/Avatar.vue';

	// Models
	import { type FieldOption } from '@hub-client/models/validation/TFormOption';

	import Icon from '@hub-client/new-design/components/Icon.vue';

	// Props
	const props = withDefaults(
		defineProps<{
			value: FieldOption | string;
		}>(),
		{},
	);

	const _emit = defineEmits(['filter']);

	// Computed
	const label = computed(() => {
		if (typeof props.value === 'string') return props.value;
		return props.value?.label ?? props.value;
	});

	const icon = computed(() => {
		if (props.value && typeof props.value !== 'string') {
			if (props.value.icon) return props.value.icon;
		}
		return undefined;
	});

	const avatar = computed(() => {
		if (props.value && typeof props.value !== 'string') {
			if (typeof props.value.avatar !== 'undefined') return props.value.avatar;
		}
		return undefined;
	});
</script>
