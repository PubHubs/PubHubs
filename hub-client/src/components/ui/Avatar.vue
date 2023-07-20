<template>
	<div class="rounded-full w-12 h-12">
		<img v-if="img != ''" :src="img" :alt="alt" />
	</div>
</template>
<script setup lang="ts">
	defineProps({
		img: {
			type: String,
			default: '',
		},
		alt: {
			type: String,
			default: '',
		},
	});
</script>
