<template>
	<Button
		class="m-100"
		:class="isStartButton ? '' : 'animate-pulse'"
		:variant="isStartButton ? 'primary' : 'error'"
		icon="video"
		:title="isStartButton ? t('videocall.start_tooltip') : t('videocall.join_tooltip')"
	>
		<span v-if="!isStartButton">{{ t('videocall.join') }}</span>
	</Button>
</template>

<script setup lang="ts">
	import { useI18n } from 'vue-i18n';

	import Button from '@hub-client/components/elements/Button.vue';

	defineProps({
		isStartButton: {
			type: Boolean,
			default: false,
		},
	});

	const { t } = useI18n();
</script>
