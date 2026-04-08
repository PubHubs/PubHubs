<template>
	<div class="flex flex-row items-center gap-1 wrap-break-word">
		<Button
			icon="plus"
			@click="$router.push({ name: 'create-topic' })"
			>Add New</Button
		>
	</div>
</template>
<script setup lang="ts">
	import Button from '@hub-client/new-design/components/Button.vue';
</script>
