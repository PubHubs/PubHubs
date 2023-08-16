<template>
	<div class="relative z-0">
		<div v-if="masked" class="absolute bg-white opacity-70 h-full w-full z-100"></div>
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
