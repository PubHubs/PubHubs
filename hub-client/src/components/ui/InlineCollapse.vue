<template>
	<div>
		<slot
			:collapsed="collapsed"
			name="visible"
		/>
	</div>
	<div
		v-show="!collapsed"
		class="-z-10 mt-2"
	>
		<slot
			:collapsed="collapsed"
			name="collapsed"
		/>
	</div>
</template>

<script lang="ts" setup>
	import { provide, ref } from 'vue';

	const collapsed = ref(true);

	function toggle() {
		collapsed.value = !collapsed.value;
	}

	provide('toggle', toggle);
</script>
