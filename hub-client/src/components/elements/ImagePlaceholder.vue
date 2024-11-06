<template>
	<img :src="source" v-show="ready" @load="imgLoadReady()" class="object-cover object-center w-full h-full" />
</template>

<script setup>
	import { ref } from 'vue';

	const props = defineProps({
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
