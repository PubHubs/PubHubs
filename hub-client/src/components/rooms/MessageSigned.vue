<template>
	<div class="flex rounded-lg bg-hub-background-3 p-2">
		<div class="w-full p-2">
			<div class="flex">
				<h3 class="font-bold">{{ $t('message.messageSigned.heading') }}</h3>
				<Icon :type="'closingCross'" :size="'sm'" :asButton="false" @mouseover="showVerificationStatus = true" @mouseout="showVerificationStatus = false" class="ml-1 mt-[3px] text-red"></Icon>
				<div class="relative">
					<div v-if="showVerificationStatus" class="absolute bottom-8 w-32 rounded-md bg-hub-background-3 p-2">
						<p class="text-xs">{{ $t('message.messageSigned.verificationStatus') }}</p>
					</div>
				</div>
			</div>
			<p>{{ getMessage(message) }}</p>
			<ul class="mt-1 flex justify-end">
				<li v-for="attribute in getDisclosedAttributes(message)" :key="attribute.id" class="flex w-fit items-center rounded-full bg-black px-2 text-white">
					<Icon :type="'sign'" :size="'sm'" class="mr-1"></Icon>

					{{
						//todo: add multilanguage support
						attribute.rawvalue
					}}
				</li>
			</ul>
		</div>

		<div class="flex w-5 flex-col items-center">
			<Icon :type="'info'" :size="'sm'" :asButton="false" class="mb-1 mt-1" @mouseover="showInfo = true" @mouseout="showInfo = false"></Icon>
			<!-- An extra div to ensure the info popup is always positioned the same -->
			<div class="relative">
				<div v-if="showInfo" class="absolute bottom-8 w-32 rounded-md bg-hub-background-3 p-2">
					<p class="text-xs">{{ $t('message.messageSigned.info') }}</p>
				</div>
			</div>
			<!-- Not supported yet -->
			<!-- <Icon :type="'download'" :size="'sm'" :asButton="true" class=" "></Icon> -->
		</div>
	</div>
</template>

<script setup lang="ts">
	// Components
	import Icon from '../elements/Icon.vue';

	import { SignedMessage, getDisclosedAttributes, getMessage } from '@/lib/signedMessages';
	import { ref } from 'vue';

	type Props = {
		message: SignedMessage;
	};
	const props = defineProps<Props>();

	const showInfo = ref(false);
	const showVerificationStatus = ref(false);
</script>
