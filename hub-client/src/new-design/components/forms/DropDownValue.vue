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
	import { computed } from 'vue';

	import Avatar from '@hub-client/components/ui/Avatar.vue';

	import Icon from '@hub-client/new-design/components/Icon.vue';

	// Props
	const props = withDefaults(
		defineProps<{
			value: Object | String;
		}>(),
		{},
	);

	const label = computed(() => {
		if (props.value) {
			if (props.value.label) return props.value.label;
		}
		return props.value;
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
