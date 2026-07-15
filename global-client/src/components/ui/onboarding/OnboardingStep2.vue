<template>
	<OnboardingTemplate class>
		<template #column1>
			<OnboardingTitle />
			<p class="mb-200 whitespace-pre-line">
				{{ $t('register.use_yivi') }}
			</p>
			<p>{{ $t('register.start_registration') }}</p>
			<ol class="my-200 list-outside list-decimal pl-200">
				<li>{{ $t('register.overview_step1') }}</li>
				<li>{{ $t('register.overview_step2') }}</li>
				<li>{{ $t('register.overview_step3') }}</li>
			</ol>
			<p>{{ $t('register.yivi_downloaded') }}</p>
			<Button
				class="mt-300 mr-300 w-4000 max-w-full"
				@click="emit('next')"
			>
				{{ $t('register.yivi_no') }}
			</Button>
			<Button
				class="mt-300 mb-200 w-4000 max-w-full py-150 leading-tight"
				@click="emit('skip')"
			>
				{{ $t('register.yivi_yes') }}<br /><span class="text-body text-nowrap">({{ $t('register.skip_step1') }})</span>
			</Button>
		</template>
		<template #column2>
			<div class="hidden h-4000 lg:flex">
				<div class="flex w-full">
					<img
						alt="PubHubs mascot with phone"
						src="../../../assets/mascot-attributes.svg"
					/>
				</div>
			</div>
		</template>
	</OnboardingTemplate>
</template>

<script lang="ts" setup>
	// Components
	import Button from '@hub-client/components/elements/Button.vue';

	const emit = defineEmits(['next', 'skip']);
</script>
