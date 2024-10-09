<template>
	<OnboardingTemplate>
		<template #column1>
			<Progressbar :currentStep="3"></Progressbar>
			<OnboardingTitle />
			<p>
				<b>{{ $t('register.step', [3]) }}</b>
				&nbsp; {{ $t('register.overview_step3') }}.
			</p>
			<p class="mt-4 mb-2">{{ $t('register.rewards.almost_done') }}</p>
			<ol class="list-disc list-outside pl-4 my-4">
				<li>{{ $t('register.overview_step3') }}</li>
				<li>{{ $t('register.data_share') }}</li>
				<li>{{ $t('register.add_registration') }}</li>
			</ol>
			<p class="whitespace-pre-line">{{ $t('register.rewards.hooray', ['&#127881;']) }}</p>
			<a href="javascript:void(0)" class="lg:block hidden text-sm underline underline-offset-4 mt-8" @click="$emit('back')">&#x27F5; {{ $t('register.step_previous') }}</a>
		</template>
		<template #column2>
			<div class="w-3/4 lg:w-full flex flex-col">
				<div class="-mt-4 lg:mt-0 mb-4 flex w-full lg:justify-center">
					<div
						id="yivi-register"
						class="relative max-h-fit after:hidden after:lg:block after:absolute after:-right-[1.2em] after:top-[60%] after:border-[1.25em] after:border-transparent after:border-l-white after:border-t-0 after:border-r-0 after:drop-shadow-[0_5px_16px_rgba(0,0,0,0.15)]"
					>
						<!-- Yivi content -->
					</div>
					<div class="relative right-4 hidden lg:flex w-64">
						<img src="../../../assets/mascot-attributes-small.svg" alt="PubHubs mascot with attributes" />
					</div>
				</div>
				<a href="javascript:void(0)" class="flex lg:hidden text-sm underline underline-offset-4" @click="$emit('back')">&#x27F5; {{ $t('register.step_previous') }}</a>
			</div>
			<div class="lg:hidden">
				<img class="relative left-1/2 md:left-3/4 -mb-28 w-40 pb-4" src="../../../assets/mascot-yivi-app-small.svg" />
			</div>
			<form method="POST" action="/yivi-endpoint/finish-and-redirect">
				<input type="hidden" name="yivi_token" :value="yivi_token" />
			</form>
		</template>
	</OnboardingTemplate>
</template>

<script setup lang="ts">
	import { onMounted, ref } from 'vue';
	import { yivi } from '@/yivi';

	const yivi_token = ref<string>('');

	onMounted(() => {
		yivi(true, yivi_token);
	});

	window.addEventListener('pageshow', () => yivi(true, yivi_token));
</script>
