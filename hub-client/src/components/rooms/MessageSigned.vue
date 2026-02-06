<template>
	<div class="bg-surface flex max-w-[700px] flex-col rounded-xl border p-3">
		<div class="flex">
			<h3 class="font-bold">{{ $t('message.messageSigned.heading') }}</h3>
			<Icon type="warning" :size="'sm'" @mouseover="showVerificationStatus = true" @mouseout="showVerificationStatus = false" class="text-accent-red p-[0.6rem]" />
			<div class="relative">
				<div v-if="showVerificationStatus" class="bg-surface-high absolute right-0 bottom-6 w-32 rounded-md p-2">
					<p class="text-label-small">{{ $t('message.messageSigned.verificationStatus') }}</p>
				</div>
			</div>
			<Icon type="info" :size="'sm'" class="ml-auto p-[0.6rem]" @mouseover="showInfo = true" @mouseout="showInfo = false" />
			<!-- An extra div to ensure the info popup is always positioned the same -->
			<div class="relative">
				<div v-if="showInfo" class="bg-surface-high absolute right-2 bottom-6 w-32 rounded-md p-2">
					<p class="text-label-small">{{ $t('message.messageSigned.info') }}</p>
				</div>
			</div>
			<!-- Not supported yet -->
			<!-- <IconButton type="download-simple" :size="'sm'"  class=" "/> -->
		</div>
		<p>{{ getMessage(message) }}</p>
		<div class="flex w-full min-w-0 flex-col overflow-x-auto p-2">
			<ul class="mt-1 ml-auto flex w-fit">
				<li v-for="attribute in getDisclosedAttributes(message)" :key="attribute.id" class="flex w-fit items-center rounded-full bg-black px-2 text-white">
					<Icon type="pen-nib" :size="'sm'" class="mr-1" />

					{{
						// TODO: Add multilanguage support
						attribute.rawvalue
					}}
				</li>
			</ul>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { ref } from 'vue';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';

	// Models
	import { SignedMessage, getDisclosedAttributes, getMessage } from '@hub-client/models/components/signedMessages';

	// Types
	type Props = {
		message: SignedMessage;
	};

	const props = defineProps<Props>();

	const showInfo = ref(false);
	const showVerificationStatus = ref(false);
</script>
