<template>
	<OnboardingTemplate>
		<template #column1>
			<Progressbar :current-step="3" />
			<OnboardingTitle />
			<p>
				<b>{{ $t('others.step', [3]) }}</b>
				&nbsp; {{ $t('register.overview_step3') }}.
			</p>
			<p class="mt-4 mb-2">
				{{ $t('register.rewards.almost_done') }}
			</p>
			<ol class="my-4 list-outside list-disc pl-4">
				<li>{{ $t('register.overview_step3') }}</li>
				<li>{{ $t('register.data_share') }}</li>
				<li>{{ $t('register.add_registration') }}</li>
			</ol>
			<p class="whitespace-pre-line">
				{{ $t('register.rewards.hooray', ['&#127881;']) }}
			</p>
			<a
				class="text-label mt-8 hidden underline underline-offset-4 lg:block"
				href="javascript:void(0)"
				@click="$emit('back')"
				>&#x27F5; {{ $t('register.step_previous') }}</a
			>
		</template>
		<template #column2>
			<div class="flex w-3/4 flex-col lg:w-full">
				<div class="-mt-4 mb-4 flex w-full lg:mt-0 lg:justify-center">
					<div
						id="yivi-register"
						class="relative max-h-fit after:absolute after:top-[60%] after:-right-[1.2em] after:hidden after:border-[1.25em] after:border-t-0 after:border-r-0 after:border-transparent after:border-l-white after:drop-shadow-[0_5px_16px_rgba(0,0,0,0.15)] after:lg:block"
					>
						<!-- Yivi content -->
					</div>
					<div class="relative right-4 hidden w-64 lg:flex">
						<img
							alt="PubHubs mascot with attributes"
							src="../../../assets/mascot-attributes-small.svg"
						/>
					</div>
				</div>
				<a
					class="text-label flex underline underline-offset-4 lg:hidden"
					href="javascript:void(0)"
					@click="$emit('back')"
					>&#x27F5; {{ $t('register.step_previous') }}</a
				>
			</div>
			<div class="lg:hidden">
				<img
					class="relative left-1/2 -mb-28 w-40 pb-4 md:left-3/4"
					src="../../../assets/mascot-yivi-app-small.svg"
				/>
			</div>
			<form
				action="/yivi-endpoint/finish-and-redirect"
				method="POST"
			>
				<input
					name="yivi_token"
					type="hidden"
					:value="yivi_token"
				/>
			</form>
		</template>
	</OnboardingTemplate>
</template>

<script lang="ts" setup>
	// Packages
	import { onMounted, ref } from 'vue';

	import { startYiviSession } from '@global-client/logic/utils/yiviHandler';

	// Logic
	import { createLogger } from '@hub-client/logic/logging/Logger';

	defineEmits(['back']);

	const logger = createLogger('OnboardingStep5');
	const yivi_token = ref<string>('');

	onMounted(() => {
		try {
			startYiviSession(true, yivi_token);
		} catch (error) {
			logger.error('Yivi session on mount failed:', error);
		}
	});

	window.addEventListener('pageshow', () => startYiviSession(true, yivi_token));
</script>
