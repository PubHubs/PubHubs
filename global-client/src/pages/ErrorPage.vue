<template>
	<div class="flex h-full items-center justify-center p-10">
		<div
			class="bg-surface-low flex flex-col gap-y-4 rounded-xl px-8 py-12 text-center shadow-lg"
			:class="isMobile ? 'w-full' : 'w-8/12'"
		>
			<H1 class="text-accent-primary">
				{{ $t('errors.oops') }}
			</H1>
			<!-- eslint-disable vue/no-v-html -- sanitized via sanitizeHtml -->
			<h3
				class="font-headings text-h3 font-semibold"
				v-html="sanitizedErrorMessage"
			></h3>
			<!-- eslint-enable vue/no-v-html -->
			<router-link :to="{ name: 'home' }">
				<Button
					v-if="errorKey !== 'errors.no_hubs_found'"
					class="mx-auto block max-w-md rounded-lg py-2"
				>
					{{ $t('dialog.go_back') }}
				</Button>
			</router-link>
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { computed } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import H1 from '@hub-client/components/elements/H1.vue';

	// Logic
	import { sanitizeHtml } from '@hub-client/logic/core/sanitizer';

	// Stores
	import { useSettings } from '@hub-client/stores/settings';

	// Props
	const props = defineProps({
		errorKey: { type: String, required: true },
		errorValues: { type: Array, required: true },
	});

	const { t } = useI18n();

	const settings = useSettings();

	const isMobile = computed(() => settings.isMobileState);
	const sanitizedErrorMessage = computed(() => sanitizeHtml(t(props.errorKey, props.errorValues as string[])));
</script>
