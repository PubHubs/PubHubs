<template>
	<span class="inline-flex max-h-300 w-full items-center justify-start gap-2 truncate overflow-hidden" :title="label">
		<Avatar v-if="avatar || avatar == ''" :avatar-url="avatar" :user-id="value.value" class="h-300 w-300"></Avatar>
		<span v-if="icon" class="mr-075 h-100 w-100">
			<Icon :type="icon" size="sm" class="-mt-050"></Icon>
		</span>
		<span class="text-surface-on-surface justify-start truncate text-nowrap text-ellipsis">{{ label }}</span>
	</span>
</template>

<script setup lang="ts">
	import { computed } from 'vue';

	// Components
	import Avatar from '@hub-client/components/ui/Avatar.vue';

	// Models
	import { FieldOption } from '@hub-client/models/validation/TFormOption';

	import Icon from '@hub-client/new-design/components/Icon.vue';

	const emit = defineEmits(['filter']);

	// Props
	const props = withDefaults(
		defineProps<{
			value: FieldOption | string;
		}>(),
		{},
	);

	// Computed
	const label = computed(() => {
		if (typeof props.value === 'string') return props.value;
		return props.value?.label ?? props.value;
	});

	const icon = computed(() => {
		if (props.value) {
			if (props.value.icon) return props.value.icon;
		}
		return undefined;
	});

	const avatar = computed(() => {
		if (props.value) {
			if (typeof props.value.avatar !== 'undefined') return props.value.avatar;
		}
		return undefined;
	});
</script>
