<template>
	<div class="flex h-full items-center justify-center p-10">
		<div class="md:'-8/12 bg-surface-low flex w-full flex-col gap-y-4 rounded-xl px-8 py-12 text-center shadow-lg">
			<div v-if="errorKey === 'moderation.red_card_info'" class="flex flex-row items-center justify-center gap-x-4">
				<Icon type="exclamation-mark" size="3xl" class="text-button-red"></Icon>
				<div class="flex flex-col items-center justify-center gap-y-4">
					<H1 class="text-accent-primary capitalize">{{ $t('moderation.red_card') }}</H1>
					<H3 class="">{{ $t(errorKey) }}</H3>
					<p class="text-on-surface-variant text-sm">{{ redCardMembers.find((card) => card.userId === userStore.userId)?.reason }}</p>
					<router-link :to="fromRoute || { name: 'home' }">
						<Button class="mx-auto block max-w-md rounded-lg py-2">
							{{ $t('dialog.go_back') }}
						</Button>
					</router-link>
				</div>
			</div>
			<div v-else class="flex flex-col items-center gap-y-4">
				<H1 class="text-accent-primary">{{ $t('errors.oops') }}</H1>
				<H3 class="">{{ $t(errorKey, errorValues) }}</H3>
				<router-link :to="fromRoute || { name: 'home' }">
					<Button v-if="errorKey !== 'errors.no_hubs_found'" class="mx-auto block max-w-md rounded-lg py-2">
						{{ $t('dialog.go_back') }}
					</Button>
				</router-link>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';

	import { useModeration } from '@hub-client/composables/moderation.composable';

	import { useUser } from '@hub-client/stores/user';

	const { redCardMembers } = useModeration();
	const userStore = useUser();

	const props = defineProps({
		errorKey: { type: String, required: true },
		errorValues: { type: Array, required: true },
		fromRoute: { type: String, default: null },
	});
</script>
