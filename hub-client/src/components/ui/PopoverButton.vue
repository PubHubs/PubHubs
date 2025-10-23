<template>
	<button class="flex flex-col items-center rounded-md p-2 hover:bg-surface" @click="click">
		<Icon :type="icon"></Icon>
		<p><slot></slot></p>
	</button>
</template>

<script setup lang="ts">
	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';

	const emit = defineEmits(['click']);

	defineProps({
		icon: {
			type: String,
		},
	});

	function click() {
		emit('click');
	}
</script>
