<template>
	<div
		class="flex"
		:class="combined ? 'gap-0' : 'gap-100'"
	>
		<slot />
	</div>
</template>
<script lang="ts" setup>
	import { provide } from 'vue';

	const props = defineProps({
		combined: {
			type: Boolean,
			default: false,
		},
	});

	provide('buttonGroupCombined', props.combined);
</script>
