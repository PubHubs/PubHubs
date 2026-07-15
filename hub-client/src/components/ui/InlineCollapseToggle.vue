<template>
	<div
		class="cursor-pointer"
		role="button"
		:aria-expanded="collapsed ? 'false' : 'true'"
		tabindex="0"
		@click="toggle()"
		@keydown.enter.prevent="toggle()"
		@keydown.space.prevent="toggle()"
	>
		<slot />
	</div>
</template>

<script lang="ts" setup>
	import { type Ref, inject, ref } from 'vue';

	const toggle = inject('toggle') as () => void;
	const collapsed = inject<Ref<boolean>>('collapsed', ref(true));
</script>
