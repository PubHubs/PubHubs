<template>
	<div class="flex bg-black text-white overflow-hidden">
		<Icon :type="folded ? 'chevron-right' : 'chevron-down'" @click="toggleFold()" class="text-green"></Icon>
		<pre class="font-mono text-sm p-1" :class="folded ? 'h-16' : ''">{{ JSON.stringify(json, null, 2) }}</pre>
	</div>
</template>

<script setup lang="ts">
	import { ref } from 'vue';

	defineProps({
		json: Object,
	});

	const folded = ref(true);

	function toggleFold() {
		folded.value = !folded.value;
	}
</script>
