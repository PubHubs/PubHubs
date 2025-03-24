<template>
	<button class="flex flex-col items-center p-4" @click="click">
		<Icon type="upload" />
		<p>{{ $t('message.upload_file') }}</p>
	</button>
</template>

<script setup lang="ts">
	const emit = defineEmits(['click']);

	function click() {
		emit('click');
	}
</script>
