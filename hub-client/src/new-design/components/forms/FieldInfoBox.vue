<template>
	<div class="flex w-full gap-100">
		<div class="grow">
			<slot></slot>
		</div>
		<div v-if="info" class="text-label-small flex-none whitespace-nowrap">
			{{ info }}
		</div>
	</div>
</template>
<script setup lang="ts">
	const props = withDefaults(
		defineProps<{
			info?: string | boolean;
		}>(),
		{
			info: false,
		},
	);
</script>
