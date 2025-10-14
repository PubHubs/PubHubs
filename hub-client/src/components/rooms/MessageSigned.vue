<template>
	<div class="flex flex-col rounded-lg bg-surface p-3">
		<div class="flex">
			<h3 class="font-bold">{{ $t('message.messageSigned.heading') }}</h3>
			<Icon type="warning" :size="'sm'" @mouseover="showVerificationStatus = true" @mouseout="showVerificationStatus = false" class="p-[0.6rem] text-accent-red" />
			<div class="relative">
				<div v-if="showVerificationStatus" class="absolute bottom-6 right-0 w-32 rounded-md bg-surface-high p-2">
					<p class="~text-label-small-min/label-small-max">{{ $t('message.messageSigned.verificationStatus') }}</p>
				</div>
			</div>
			<Icon type="info" :size="'sm'" class="ml-auto p-[0.6rem]" @mouseover="showInfo = true" @mouseout="showInfo = false" />
			<!-- An extra div to ensure the info popup is always positioned the same -->
			<div class="relative">
				<div v-if="showInfo" class="absolute bottom-6 right-2 w-32 rounded-md bg-surface-high p-2">
					<p class="~text-label-small-min/label-small-max">{{ $t('message.messageSigned.info') }}</p>
				</div>
			</div>
			<!-- Not supported yet -->
			<!-- <IconButton type="download-simple" :size="'sm'"  class=" "/> -->
		</div>
		<p>{{ getMessage(message) }}</p>
		<div class="flex w-full min-w-0 flex-col overflow-x-auto p-2">
			<ul class="ml-auto mt-1 flex w-fit">
				<li v-for="attribute in getDisclosedAttributes(message)" :key="attribute.id" class="flex w-fit items-center rounded-full bg-black px-2 text-white">
					<Icon type="pen-nib" :size="'sm'" class="mr-1" />

					{{
						//todo: add multilanguage support
						attribute.rawvalue
					}}
				</li>
			</ul>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Components
	import Icon from '../elements/Icon.vue';

	import { SignedMessage, getDisclosedAttributes, getMessage } from '@/model/components/signedMessages';
	import { ref } from 'vue';

	type Props = {
		message: SignedMessage;
	};
	const props = defineProps<Props>();

	const showInfo = ref(false);
	const showVerificationStatus = ref(false);
</script>
