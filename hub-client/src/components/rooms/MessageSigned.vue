<template>
	<div class="bg-surface-base rounded-base outline-surface-elevated flex max-w-[700px] flex-col p-4 outline-3">
		<div class="flex items-center gap-100">
			<h3 class="font-bold">
				{{ $t('message.messageSigned.heading') }}
			</h3>
			<Icon
				class="ml-auto"
				size="sm"
				type="info"
				:title="$t('message.messageSigned.info')"
			/>
		</div>
		<p>{{ getMessage(message) }}</p>
		<div class="flex w-full min-w-0 flex-col overflow-x-auto p-2">
			<ul class="mt-1 ml-auto flex w-fit">
				<li
					v-for="attribute in getDisclosedAttributes(message)"
					:key="attribute.id"
					class="rounded-base bg-surface-elevated flex w-fit items-center gap-100 px-3 py-2"
				>
					<Icon
						size="sm"
						type="seal-check"
					/>

					{{
						// TODO: Add multilanguage support
						attribute.rawvalue
					}}
				</li>
			</ul>
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';

	// Models
	import { type SignedMessage, getDisclosedAttributes, getMessage } from '@hub-client/models/components/signedMessages';

	// Types
	type Props = {
		message: SignedMessage;
	};

	defineProps<Props>();
</script>
