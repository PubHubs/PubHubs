<template>
	<p class="mt-2">
		{{ $t('file.file') }}: <span class="text-green">{{ message.body }}</span> {{ message.info }}
	</p>
</template>

<script setup lang="ts">
import { M_FileMessageEventContent } from '@/types/events';

	const props = defineProps<{message: M_FileMessageEventContent}>();
</script>
