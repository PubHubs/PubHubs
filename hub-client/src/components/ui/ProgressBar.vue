<template>
	<div
		class="flex h-100"
		role="progressbar"
	>
		<div
			class="transition-[width]"
			:class="color"
			:style="{ width: percentage + '%' }"
		/>
		<div
			class="bg-surface-elevated transition-[width]"
			:style="{ width: 100 - percentage + '%' }"
		/>
	</div>
</template>

<script lang="ts" setup>
	defineProps({
		color: {
			type: String,
			default: 'bg-accent-primary',
		},
		percentage: {
			type: Number,
			required: true,
		},
	});
</script>
