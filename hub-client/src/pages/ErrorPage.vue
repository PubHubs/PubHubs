<template>
	<div class="flex h-full items-center justify-center p-500">
		<div class="md:'-8/12 bg-surface-base flex w-full flex-col gap-y-200 rounded-xl px-400 py-600 text-center shadow-lg">
			<div
				v-if="errorKey === 'moderation.red_card_info'"
				class="flex flex-row items-center justify-center gap-x-200"
			>
				<Icon
					type="exclamation-mark"
					class="text-accent-red-interactive"
				></Icon>
				<div class="flex flex-col items-center justify-center gap-y-200">
					<H1 class="text-accent-primary capitalize">{{ $t('moderation.red_card') }}</H1>
					<H3 class="">{{ $t(errorKey) }}</H3>
					<p class="text-on-surface text-sm">{{ redCardMembers.find((card) => card.userId === userStore.userId)?.reason }}</p>
					<router-link :to="redCardBackRoute">
						<Button class="mx-auto block max-w-md rounded-lg py-100">
							{{ $t('dialog.go_back') }}
						</Button>
					</router-link>
				</div>
			</div>
			<div
				v-else
				class="flex flex-col items-center gap-y-200"
			>
				<H1 class="text-accent-primary">{{ $t('errors.oops') }}</H1>
				<!-- eslint-disable vue/no-v-html -- sanitized via sanitizeHtml -->
				<h3
					class="font-headings text-h3 font-semibold"
					v-html="sanitizedErrorMessage"
				></h3>
				<!-- eslint-enable vue/no-v-html -->
				<router-link :to="fromRoute || { name: 'home' }">
					<Button
						v-if="errorKey !== 'errors.no_hubs_found'"
						class="mx-auto block max-w-md rounded-lg py-100"
					>
						{{ $t('dialog.go_back') }}
					</Button>
				</router-link>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import H1 from '@hub-client/components/elements/H1.vue';
	import H3 from '@hub-client/components/elements/H3.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';

	// Composables
	import { useModerationBase } from '@hub-client/composables/moderation/base.composable';
	import { useModerationRedCard } from '@hub-client/composables/moderation/red-card.composable';

	// Logic
	import { sanitizeHtml } from '@hub-client/logic/core/sanitizer';

	// Stores
	import { useUser } from '@hub-client/stores/user';

	const props = defineProps({
		errorKey: { type: String, required: true },
		errorValues: { type: Array, required: true },
		fromRoute: { type: String, default: null },
	});

	const { t } = useI18n();

	const { redCardMembers } = useModerationRedCard(useModerationBase());
	const userStore = useUser();

	const sanitizedErrorMessage = computed(() => sanitizeHtml(t(props.errorKey, props.errorValues as string[])));

	// For red card, don't go back to a room (user is banned), go home instead
	const redCardBackRoute = computed(() => {
		if (props.fromRoute && !props.fromRoute.startsWith('/room/')) {
			return props.fromRoute;
		}
		return { name: 'home' };
	});
</script>
