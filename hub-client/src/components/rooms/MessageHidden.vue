<template>
	<div class="bg-surface-base border-surface-elevated rounded-base flex w-fit flex-col gap-2 border-3">
		<!-- Spoiler header - always visible -->
		<button
			class="flex items-center gap-2 px-3 py-2"
			@click="isRevealed = !isRevealed"
		>
			<Icon
				:type="isRevealed ? 'caret-down' : 'caret-right'"
				size="sm"
			/>
			<span class="text-label-tiny uppercase">
				{{ spoilerLabel || capitalize(t('moderation.hidden_message')) }}
			</span>
		</button>

		<div
			v-if="isRevealed"
			class="mb-200 pl-3"
		>
			<slot />
		</div>
	</div>
</template>

<script setup lang="ts">
	import { capitalize, computed, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	import Icon from '@hub-client/components/elements/Icon.vue';

	const props = defineProps<{
		overridelabel?: string;
	}>();

	const { t } = useI18n();

	const isRevealed = ref(false);
	const spoilerLabel = computed(() => props.overridelabel);
</script>
