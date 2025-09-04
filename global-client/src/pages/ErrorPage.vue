<template>
	<div class="flex h-full items-center justify-center p-10">
		<div class="flex flex-col gap-y-4 rounded-xl bg-surface-low px-8 py-12 text-center shadow-lg" :class="isMobile ? 'w-full' : 'w-8/12'">
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
	import Button from '@/components/elements/Button.vue';
	import { useSettings } from '@/logic/store/settings';
	import { computed } from 'vue';

	const settings = useSettings();
	const isMobile = computed(() => settings.isMobileState);
	const props = defineProps({
		errorKey: { type: String, required: true },
		errorValues: { type: Array, required: true },
	});
</script>
