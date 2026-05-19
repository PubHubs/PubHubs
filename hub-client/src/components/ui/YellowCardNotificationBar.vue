<template>
	<div class="bg-accent-orange/10 border-accent-orange rounded-t-base flex h-500 items-center justify-between gap-100 border-b px-200 py-150">
		<div class="gap-050 flex min-w-0 flex-col">
			<div class="text-label-small text-accent-orange flex items-center gap-100">
				<Icon
					class="shrink-0"
					size="sm"
					type="exclamation-mark"
				/>
				<span class="font-semibold">{{ capitalize($t('moderation.you_have_warning')) }} {{ reason }}</span>
			</div>
		</div>

		<Icon
			type="check"
			class="hover:cursor-pointer"
			@click="emit('dismiss')"
		>
		</Icon>
	</div>
</template>

<script setup lang="ts">
	// Components
	import { capitalize } from 'vue';

	import Icon from '@hub-client/components/elements/Icon.vue';

	defineProps<{
		reason: string;
	}>();

	const emit = defineEmits<{
		dismiss: [];
	}>();
</script>
