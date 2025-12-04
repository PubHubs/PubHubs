<template>
	<div>
		<slot name="visible" :collapsed="collapsed"></slot>
	</div>
	<div v-show="!collapsed" class="-z-10 mt-2">
		<slot name="collapsed" :collapsed="collapsed"></slot>
	</div>
</template>

<script setup lang="ts">
	import { provide, ref } from 'vue';

	const collapsed = ref(true);

	function toggle() {
		collapsed.value = !collapsed.value;
	}

	provide('toggle', toggle);
</script>
