<template>
	<div class="flex h-full items-center justify-center p-10">
		<div class="bg-surface-low flex flex-col gap-y-4 rounded-xl px-8 py-12 text-center shadow-lg" :class="isMobile ? 'w-full' : 'w-8/12'">
			<H1 class="text-accent-primary">{{ $t('errors.oops') }}</H1>
			<H3 class="">{{ $t(errorKey, errorValues) }}</H3>
			<router-link :to="{ name: 'home' }">
				<Button v-if="errorKey !== 'errors.no_hubs_found'" class="mx-auto block max-w-md rounded-lg py-2">
					{{ $t('dialog.go_back') }}
				</Button>
			</router-link>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed } from 'vue';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import H1 from '@hub-client/components/elements/H1.vue';
	import H3 from '@hub-client/components/elements/H3.vue';

	// Stores
	import { useSettings } from '@hub-client/stores/settings';

	// Props
	const props = defineProps({
		errorKey: { type: String, required: true },
		errorValues: { type: Array, required: true },
	});

	const settings = useSettings();

	const isMobile = computed(() => settings.isMobileState);
</script>
