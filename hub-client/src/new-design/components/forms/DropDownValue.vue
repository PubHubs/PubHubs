<template>
	<span class="inline-flex max-h-300 items-center justify-start gap-2 overflow-hidden">
		<Avatar v-if="avatar || avatar == ''" :avatar-url="avatar" :user-id="value.value" class="h-300 w-300"></Avatar>
		<div v-if="icon" class="h-250 w-250 overflow-hidden">
			<Icon :type="icon" class="h-250 w-250"></Icon>
		</div>
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
