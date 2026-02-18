<template>
	<span class="inline-flex max-h-300 items-center justify-start gap-2">
		<Avatar v-if="avatar || avatar == ''" :avatar-url="avatar" :user-id="value.value" class="h-300 w-300"></Avatar>
		<span v-if="icon" class="h-100 w-100">
			<Icon :type="icon" size="sm" class="-mt-050 -ml-025 mr-050"></Icon>
		</span>
		<span class="text-surface-on-surface justify-start text-nowrap">{{ label }}</span>
	</span>
</template>

<script setup lang="ts">
	// Packages
	import { computed } from 'vue';

	// Components
	import Avatar from '@hub-client/components/ui/Avatar.vue';

	// Models
	import { FieldOption } from '@hub-client/models/validation/TFormOption';

	import Icon from '@hub-client/new-design/components/Icon.vue';

	// Props
	const props = defineProps<{
		value: FieldOption | string;
	}>();

	// Computed
	const avatar = computed(() => {
		if (typeof props.value === 'string') return undefined;
		return props.value?.avatar;
	});

	const icon = computed(() => {
		if (typeof props.value === 'string') return undefined;
		return props.value?.icon;
	});

	const label = computed(() => {
		if (typeof props.value === 'string') return props.value;
		return props.value?.label ?? props.value;
	});
</script>
