<template>
	<div class="flex overflow-hidden bg-black text-white">
		<Icon
			class="text-accent-primary"
			:type="folded ? 'caret-right' : 'caret-down'"
			@click.stop="toggleFold()"
		/>
		<pre
			v-if="!folded"
			class="font-mono"
			>{{ JSON.stringify(json, null, 2) }}</pre
		>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { ref } from 'vue';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';

	defineProps({
		json: {
			type: Object,
			default: undefined,
		},
	});

	const folded = ref(false);

	function toggleFold() {
		folded.value = !folded.value;
	}
</script>
