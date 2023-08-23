<template>
	<div class="rounded-full w-12 h-12" @click="writeUserToCLipboard()">
		<img v-if="img != ''" :src="img" :alt="alt" />
	</div>
</template>
<script setup lang="ts">
	const props = defineProps({
		img: {
			type: String,
			default: '',
		},
		alt: {
			type: String,
			default: '',
		},
		user: {
			type: String,
			required: true,
		},
	});

	function writeUserToCLipboard() {
		navigator.clipboard.writeText(props.user);
	}
</script>
