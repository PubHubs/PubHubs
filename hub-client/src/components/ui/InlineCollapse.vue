<template>
	<div>
		<slot
			:collapsed="collapsed"
			:toggle="toggle"
			name="visible"
		/>
	</div>
	<div
		v-show="!collapsed"
		class="-z-10 mt-100"
	>
		<slot
			:collapsed="collapsed"
			name="collapsed"
		/>
	</div>
</template>

<script lang="ts" setup>
	import { ref } from 'vue';

	const collapsed = ref(true);

	function toggle() {
		collapsed.value = !collapsed.value;
	}
</script>
