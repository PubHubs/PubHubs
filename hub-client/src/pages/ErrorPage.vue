<template>
	<div class="flex h-full items-center justify-center p-10">
		<div class="md:'-8/12 bg-surface-low flex w-full flex-col gap-y-4 rounded-xl px-8 py-12 text-center shadow-lg">
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
	// Components
	import Button from '@hub-client/components/elements/Button.vue';

	const props = defineProps({
		errorKey: { type: String, required: true },
		errorValues: { type: Array, required: true },
	});
</script>
