<template>
	<OnboardingTemplate class>
		<template #column1>
			<OnboardingTitle />
			<p class="mb-4 whitespace-pre-line">{{ $t('register.use_yivi') }}</p>
			<p>{{ $t('register.start_registration') }}</p>
			<ol class="my-4 list-outside list-decimal pl-4">
				<li>{{ $t('register.overview_step1') }}</li>
				<li>{{ $t('register.overview_step2') }}</li>
				<li>{{ $t('register.overview_step3') }}</li>
			</ol>
			<p>{{ $t('register.yivi_downloaded') }}</p>
			<Button class="mr-6 mt-6 w-[320px] max-w-full" @click="$emit('next')">{{ $t('register.yivi_no') }}</Button>
			<Button class="mb-4 mt-6 w-[320px] max-w-full py-3 leading-tight" @click="$emit('skip')">
				{{ $t('register.yivi_yes') }}<br /><span class="~text-body-min/body-max text-nowrap">({{ $t('register.skip_step1') }})</span>
			</Button>
		</template>
		<template #column2>
			<div class="hidden h-[320px] lg:flex">
				<div class="flex w-full">
					<img src="../../../assets/mascot-yivi-app.svg" alt="PubHubs mascot with Yivi app and Pubhubs screen silhouette" />
				</div>
			</div>
			<div class="-mt-4 lg:hidden">
				<img class="relative left-1/2 -mb-20 w-40 pb-4 md:left-3/4" src="../../../assets/mascot-yivi-app-small.svg" />
			</div>
		</template>
	</OnboardingTemplate>
</template>
