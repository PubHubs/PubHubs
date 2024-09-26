<template>
	<OnboardingTemplate>
		<template #column1>
			<Progressbar :currentStep="2"></Progressbar>
			<OnboardingTitle />
			<p>
				<b>{{ $t('register.step', [2]) }}</b>
				&nbsp; {{ $t('register.overview_step2') }}.
			</p>
			<p class="mt-4 mb-2">{{ $t('register.rewards.good_job') }}</p>
			<p class="my-2">{{ $t('register.data_request') }}</p>
			<p class="my-2">{{ $t('register.data_add') }}</p>
			<Foldout :question="`${$t('register.data_add_how')}`">
				{{ $t('register.data_add_how_answer') }}
			</Foldout>
			<Foldout :question="`${$t('register.data_why')}`">
				{{ $t('register.data_why_answer') }}
			</Foldout>
			<label for="attributesAdded" class="flex mt-6 font-bold">
				<Checkbox id="attributesAdded" class="h-[16px] w-[16px] mt-1 sm:mt-0.5 mr-2" v-model="checked" :color="'blue'"> </Checkbox>
				{{ $t('register.data_added') }}
			</label>
			<Button class="w-fit my-4" :disabled="!checked" @click="$emit('next')">{{ $t('register.step_go_to', [3]) }} &#x27F6;</Button>
			<a href="javascript:void(0)" class="text-sm underline underline-offset-4 mt-4 mb-8" @click="$emit('back')">&#x27F5; {{ $t('register.step_previous') }}</a>
		</template>
		<template #column2>
			<div class="hidden lg:flex justify-center">
				<div class="w-3/4">
					<img src="../../assets/mascot-attributes.svg" alt="PubHubs mascot with attributes" />
				</div>
			</div>
			<div class="lg:hidden -mt-8">
				<img class="relative left-1/2 md:left-3/4 -mb-8 w-40" src="../../assets/mascot-yivi-app-small.svg" />
			</div>
		</template>
	</OnboardingTemplate>
</template>

<script setup lang="ts">
	import { ref } from 'vue';

	const checked = ref(false);
</script>
