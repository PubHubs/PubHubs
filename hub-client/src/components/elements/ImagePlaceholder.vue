<template>
	<div class="bg-gradient-to-t from-blue-lighter via-avatar-blue to-blue">
		<img :src="src" v-show="ready" @load="imgLoadReady()" class="w-full" />
	</div>
</template>

<script setup>
	import { ref } from 'vue';

	const props = defineProps(['src']);
	const ready = ref(false);

	function imgLoadReady() {
		ready.value = true;
	}
</script>
