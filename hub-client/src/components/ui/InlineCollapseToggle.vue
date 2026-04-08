<template>
	<div
		class="cursor-pointer"
		@click="toggle()"
	>
		<slot />
	</div>
</template>

<script lang="ts" setup>
	import { inject } from 'vue';

	const toggle = inject('toggle') as () => void;
</script>
