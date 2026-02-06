<template>
	<div class="flex overflow-hidden bg-black text-white">
		<Icon :type="folded ? 'caret-right' : 'caret-down'" @click="toggleFold()" class="text-green" />
		<pre class="text-label p-1 font-mono" :class="folded ? 'h-16' : ''">{{ JSON.stringify(json, null, 2) }}</pre>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { ref } from 'vue';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';

	defineProps({
		json: Object,
	});

	const folded = ref(true);

	function toggleFold() {
		folded.value = !folded.value;
	}
</script>
