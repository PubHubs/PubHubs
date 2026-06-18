<template>
	<div
		class="border-surface-base group-hover:bg-surface-base flex min-h-800 cursor-pointer items-center border-b px-200 py-150"
		:class="selected ? 'bg-surface-elevated' : odd ? 'bg-surface-sunken' : ''"
	>
		<slot />
	</div>
</template>

<script setup lang="ts">
	import { inject } from 'vue';

	const odd = inject<boolean>('odd', false);
	const selected = inject<boolean>('selected', false);
</script>
