<template>
	<div class="bg-surface flex max-w-[700px] flex-col gap-3 rounded-xl border p-8">
		<!-- Title -->
		<div class="flex items-center">
			<h3 class="font-bold">
				{{ t('admin.disclosure_sign_message') }}
			</h3>

			<Icon
				class="text-accent-red p-[0.6rem]"
				size="sm"
				type="warning"
				@mouseout="showVerificationStatus = false"
				@mouseover="showVerificationStatus = true"
			/>

			<div class="relative">
				<div
					v-if="showVerificationStatus"
					class="bg-surface-high absolute right-0 bottom-6 w-40 rounded-md p-2"
				>
					<p class="text-label-small">
						{{ $t('message.messageSigned.verificationStatus') }}
					</p>
				</div>
			</div>

			<Icon
				class="ml-auto p-[0.6rem]"
				size="sm"
				type="info"
				@mouseout="showInfo = false"
				@mouseover="showInfo = true"
			/>

			<div class="relative">
				<div
					v-if="showInfo"
					class="bg-surface-high absolute right-2 bottom-6 w-40 rounded-md p-2"
				>
					<p class="text-label-small">
						{{ $t('message.messageSigned.info') }}
					</p>
				</div>
			</div>
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
	import { capitalize, computed, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';

	// Models
	import { type SignedMessage, getDisclosedAttributes, getMessage } from '@hub-client/models/components/signedMessages';

	import { useSettings } from '@hub-client/stores/settings';

	// Types
	type Props = {
		message: SignedMessage;
	};

	defineProps<Props>();
	const { t } = useI18n();
	const settings = useSettings();

	const isMobile = computed(() => settings.isMobileState);

	const showInfo = ref(false);
	const showVerificationStatus = ref(false);
</script>
