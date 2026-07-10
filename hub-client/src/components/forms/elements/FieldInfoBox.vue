<template>
	<div class="pt-050 gap-050 flex w-full items-baseline">
		<!-- min-h reserves one line of text so a validation error appearing doesn't shift the layout. -->
		<div class="text-label-small min-h-[1lh] grow">
			<slot />
		</div>
		<div
			v-if="info"
			class="text-on-surface-dim text-label-small flex-none whitespace-nowrap"
		>
			{{ info }}
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Props
	withDefaults(
		defineProps<{
			info?: string | boolean;
		}>(),
		{
			info: false,
		},
	);
</script>
