<template>
	<div class="bg-surface-base rounded-base border-surface-elevated flex max-w-[700px] flex-col gap-3 border-3 p-8">
		<!-- Title -->
		<div class="flex items-center">
			<h3 class="font-bold">
				{{ t('admin.disclosure_sign_message') }}
			</h3>
			<Icon
				class="ml-auto"
				size="sm"
				type="info"
				:title="$t('message.messageSigned.info')"
			/>
		</div>

		<!-- Disclosed values (main content) -->
		<div class="flex max-w-[400px] flex-col gap-2">
			<div
				class="flex items-center gap-2 rounded-lg border bg-white p-4"
				:class="!isMobile ? 'flex-row' : 'flex-col'"
			>
				<img
					alt="Yivi"
					class="h-[1.75rem]"
					src="@hub-client/assets/yivi-logo.svg"
				/>
				<div class="flex flex-wrap items-center gap-2 break-all">
					<div
						v-for="attribute in getDisclosedAttributes(message)"
						:key="attribute.id"
						class="Wrounded-md flex flex-col items-start text-black"
					>
						<H3>{{ capitalize(t('attribute.' + attribute.id)) }}</H3>
						<P>{{ attribute.rawvalue }}</P>
					</div>
				</div>
			</div>
		</div>

		<!-- Optional message text -->
		<p class="text-body-small text-muted">
			{{ getMessage(message) }}
		</p>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { capitalize, computed } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import H3 from '@hub-client/components/elements/H3.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import P from '@hub-client/components/elements/P.vue';

	// Models
	import { type SignedMessage, getDisclosedAttributes, getMessage } from '@hub-client/models/components/signedMessages';

	// Stores
	import { useSettings } from '@hub-client/stores/settings';

	// Types
	type Props = {
		message: SignedMessage;
	};

	// Props
	defineProps<Props>();

	const { t } = useI18n();
	const settings = useSettings();

	const isMobile = computed(() => settings.isMobileState);
</script>
