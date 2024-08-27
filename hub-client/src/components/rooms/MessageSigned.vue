<template>
	<div class="bg-hub-background-3 flex rounded-lg p-2">
		<div class="p-2 w-full">
			<div class="flex">
				<h3 class="font-bold">{{ $t('message.messageSigned.heading') }}</h3>
				<Icon :type="'closingCross'" :size="'sm'" :asButton="false" @mouseover="showVerificationStatus = true" @mouseout="showVerificationStatus = false" class="ml-1 mt-[3px] text-red"></Icon>
				<div class="relative">
					<div v-if="showVerificationStatus" class="absolute bottom-8 w-32 bg-hub-background-3 rounded-md p-2">
						<p class="text-xs">{{ $t('message.messageSigned.verificationStatus') }}</p>
					</div>
				</div>
			</div>
			<p>{{ getMessage(message) }}</p>
			<ul class="flex justify-end mt-1">
				<li v-for="attribute in getDisclosedAttributes(message)" :key="attribute.id" class="bg-black rounded-full w-fit flex items-center text-white px-2">
					<Icon :type="'sign'" :size="'sm'" class="mr-1"></Icon>

					{{
						//todo: add multilanguage support
						attribute.rawvalue
					}}
				</li>
			</ul>
		</div>

		<div class="flex flex-col items-center w-5">
			<Icon :type="'info'" :size="'sm'" :asButton="false" class="mt-1 mb-1" @mouseover="showInfo = true" @mouseout="showInfo = false"></Icon>
			<!-- An extra div to ensure the info popup is always positioned the same -->
			<div class="relative">
				<div v-if="showInfo" class="absolute bottom-8 w-32 bg-hub-background-3 rounded-md p-2">
					<p class="text-xs">{{ $t('message.messageSigned.info') }}</p>
				</div>
			</div>
			<!-- Not supported yet -->
			<!-- <Icon :type="'download'" :size="'sm'" :asButton="true" class=" "></Icon> -->
		</div>
	</div>
</template>

<script setup lang="ts">
	import { SignedMessage, getDisclosedAttributes, getMessage } from '@/lib/signedMessages';
	import { ref } from 'vue';

	type Props = {
		message: SignedMessage;
	};
	const props = defineProps<Props>();

	const showInfo = ref(false);
	const showVerificationStatus = ref(false);
</script>
