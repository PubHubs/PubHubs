<template>
	<div class="flex overflow-hidden bg-black text-white">
		<Icon :type="folded ? 'caret-right' : 'caret-down'" @click.stop="toggleFold()" class="text-accent-primary" />
		<pre v-if="!folded" class="font-mono">{{ JSON.stringify(json, null, 2) }}</pre>
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

	const folded = ref(false);

	function toggleFold() {
		folded.value = !folded.value;
	}
</script>
