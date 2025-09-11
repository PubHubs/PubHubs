<template>
	<button class="m-2 flex flex-col items-center" @click="click">
		<Icon class="dark:text-white" type="upload"></Icon>
		<p>{{ $t('message.upload_file') }}</p>
	</button>
</template>

<script setup lang="ts">
	const emit = defineEmits(['click']);

	function click() {
		emit('click');
	}
</script>
