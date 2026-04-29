<template>
	<div class="flex flex-col gap-2">
		<!-- Spoiler header - always visible -->
		<button
			class="bg-surface-low flex items-center gap-2 rounded-md px-3 py-2"
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
			class="border-on-surface-disabled border-l-2 pl-3"
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
