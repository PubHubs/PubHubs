<template>
	<OnboardingTemplate>
		<template #column1>
			<Progressbar :currentStep="3" />
			<OnboardingTitle />
			<p>
				<b>{{ $t('register.step', [3]) }}</b>
				&nbsp; {{ $t('register.overview_step3') }}.
			</p>
			<p class="mb-2 mt-4">{{ $t('register.rewards.almost_done') }}</p>
			<ol class="my-4 list-outside list-disc pl-4">
				<li>{{ $t('register.overview_step3') }}</li>
				<li>{{ $t('register.data_share') }}</li>
				<li>{{ $t('register.add_registration') }}</li>
			</ol>
			<p class="whitespace-pre-line">{{ $t('register.rewards.hooray', ['&#127881;']) }}</p>
			<a href="javascript:void(0)" class="mt-8 hidden underline underline-offset-4 ~text-label-min/label-max lg:block" @click="$emit('back')">&#x27F5; {{ $t('register.step_previous') }}</a>
		</template>
		<template #column2>
			<div class="flex w-3/4 flex-col lg:w-full">
				<div class="-mt-4 mb-4 flex w-full lg:mt-0 lg:justify-center">
					<div
						id="yivi-register"
						class="relative max-h-fit after:absolute after:-right-[1.2em] after:top-[60%] after:hidden after:border-[1.25em] after:border-r-0 after:border-t-0 after:border-transparent after:border-l-white after:drop-shadow-[0_5px_16px_rgba(0,0,0,0.15)] after:lg:block"
					>
						<!-- Yivi content -->
					</div>
					<div class="relative right-4 hidden w-64 lg:flex">
						<img src="../../../assets/mascot-attributes-small.svg" alt="PubHubs mascot with attributes" />
					</div>
				</div>
				<a href="javascript:void(0)" class="flex underline underline-offset-4 ~text-label-min/label-max lg:hidden" @click="$emit('back')">&#x27F5; {{ $t('register.step_previous') }}</a>
			</div>
			<div class="lg:hidden">
				<img class="relative left-1/2 -mb-28 w-40 pb-4 md:left-3/4" src="../../../assets/mascot-yivi-app-small.svg" />
			</div>
			<form method="POST" action="/yivi-endpoint/finish-and-redirect">
				<input type="hidden" name="yivi_token" :value="yivi_token" />
			</form>
		</template>
	</OnboardingTemplate>
</template>

<script setup lang="ts">
	import { onMounted, ref } from 'vue';
	import startYiviSession from '@/logic/utils/yiviHandler';

	const yivi_token = ref<string>('');

	onMounted(() => {
		try {
			startYiviSession(true, yivi_token);
		} catch (error) {
			console.error('Yivi session on mount failed:', error);
		}
	});

	window.addEventListener('pageshow', () => yivi(true, yivi_token));
</script>
