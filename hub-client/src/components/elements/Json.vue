<template>
	<div class="flex overflow-hidden bg-black text-white">
		<Icon :type="folded ? 'chevron-right' : 'chevron-down'" @click="toggleFold()" class="text-green"></Icon>
		<pre class="font-mono p-1 text-sm" :class="folded ? 'h-16' : ''">{{ JSON.stringify(json, null, 2) }}</pre>
	</div>
</template>

<script setup lang="ts">
	// Components
	import Icon from './Icon.vue';

	import { ref } from 'vue';

	defineProps({
		json: Object,
	});

	const folded = ref(true);

	function toggleFold() {
		folded.value = !folded.value;
	}
</script>
