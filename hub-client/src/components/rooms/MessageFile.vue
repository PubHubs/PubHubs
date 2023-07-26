<template>
	<p class="mt-2">
		{{ $t('file.file') }}: <span class="text-green">{{ message.body }}</span> {{ message.info }}
	</p>
</template>

<script setup lang="ts">
	const props = defineProps({
		message: {
			type: Object,
			required: true,
		},
	});
</script>
