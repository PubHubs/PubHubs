<template>
	<div class="flex overflow-hidden bg-black text-white">
		<Icon :type="folded ? 'chevron-right' : 'chevron-down'" @click="toggleFold()" class="text-green" />
		<pre class="p-1 font-mono ~text-label-min/label-max" :class="folded ? 'h-16' : ''">{{ JSON.stringify(json, null, 2) }}</pre>
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
