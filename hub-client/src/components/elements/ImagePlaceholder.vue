<template>
	<img
		v-show="ready"
		class="h-full w-full object-cover object-center"
		:src="source"
		@load="imgLoadReady()"
	/>
</template>

<script setup>
	// Packages
	import { ref } from 'vue';

	defineProps({
		source: {
			type: String,
			default: 'img/imageplaceholder.jpg',
		},
	});
	const ready = ref(false);

	function imgLoadReady() {
		ready.value = true;
	}
</script>
