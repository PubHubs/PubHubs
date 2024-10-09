<template>
	<OnboardingTemplate class>
		<template #column1>
			<OnboardingTitle />
			<p class="mb-4 whitespace-pre-line">{{ $t('register.use_yivi') }}</p>
			<p>{{ $t('register.start_registration') }}</p>
			<ol class="list-decimal list-outside pl-4 my-4">
				<li>{{ $t('register.overview_step1') }}</li>
				<li>{{ $t('register.overview_step2') }}</li>
				<li>{{ $t('register.overview_step3') }}</li>
			</ol>
			<p>{{ $t('register.yivi_downloaded') }}</p>
			<Button class="w-80 max-w-full mt-6 mr-6" @click="$emit('next')">{{ $t('register.yivi_no') }}</Button>
			<Button class="w-80 max-w-full mt-6 mb-4 leading-tight py-3" @click="$emit('skip')">
				{{ $t('register.yivi_yes') }}<br /><span class="text-nowrap text-base">({{ $t('register.skip_step1') }})</span>
			</Button>
		</template>
		<template #column2>
			<div class="hidden lg:flex h-80">
				<div class="flex w-full">
					<img src="../../../assets/mascot-yivi-app.svg" alt="PubHubs mascot with Yivi app and Pubhubs screen silhouette" />
				</div>
			</div>
			<div class="lg:hidden -mt-4">
				<img class="relative left-1/2 md:left-3/4 -mb-20 w-40 pb-4" src="../../../assets/mascot-yivi-app-small.svg" />
			</div>
		</template>
	</OnboardingTemplate>
</template>
