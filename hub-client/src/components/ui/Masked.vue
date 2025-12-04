<template>
	<div class="relative z-0">
		<div v-if="masked" class="absolute z-100 h-full w-full bg-white opacity-70"></div>
		<div class="z-100">
			<slot></slot>
		</div>
	</div>
</template>

<script setup lang="ts">
	const props = defineProps({
		masked: {
			type: Boolean,
			default: false,
		},
	});
</script>
