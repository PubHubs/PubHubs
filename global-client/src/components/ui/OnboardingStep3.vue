<template>
	<OnboardingTemplate>
		<template #column1>
			<Progressbar :currentStep="1"></Progressbar>
			<OnboardingTitle />
			<p>
				<b>{{ $t('register.step', [1]) }}</b>
				&nbsp; {{ $t('register.install_yivi') }}
			</p>
			<p class="mt-4">
				<b>{{ $t('register.yivi_what') }}</b>
				&nbsp; {{ $t('register.yivi_short_description') }}
			</p>
			<p class="mt-4">{{ $t('register.yivi_download') }}</p>
			<H3 class="lg:hidden mt-4 theme-light:text-black mb-0">Download Yivi</H3>
			<DownloadLinks class="lg:hidden mt-2"></DownloadLinks>
			<label for="yiviDownloaded" class="flex mt-4 font-bold">
				<Checkbox id="yiviDownloaded" class="h-[16px] w-[16px] mt-1 sm:mt-0.5 mr-2" v-model="checked" :color="'blue'"></Checkbox>
				{{ $t('register.yivi_installed') }}
			</label>
			<Button class="w-fit mt-6 mb-4" :disabled="!checked" @click="$emit('next')">{{ $t('register.step_go_to', [2]) }} &#x27F6;</Button>
			<H3 class="mt-4 theme-light:text-black mb-0">{{ $t('register.more') }}</H3>
			<Foldout :question="`${$t('register.yivi_workings')}`">
				<i18n-t keypath="register.yivi_workings_answer">
					<template #hyperlink>
						<a class="font-semibold text-blue underline hover:no-underline" :href="`${$t('register.yivi_link')}`" target="_blank">Yivi.app</a>
					</template>
				</i18n-t>
			</Foldout>
			<Foldout :question="`${$t('register.yivi_why')}`">
				<i18n-t keypath="register.yivi_why_answer">
					<template #reasons>
						<ol class="list-disc list-outside pl-4 my-4">
							<li>{{ $t('register.yivi_why_central_login') }}</li>
							<li>{{ $t('register.yivi_why_room_login') }}</li>
						</ol>
					</template>
				</i18n-t>
			</Foldout>
			<a href="javascript:void(0)" class="text-sm underline underline-offset-4 mt-6 mb-8" @click="$emit('back')">&#x27F5; {{ $t('register.step_previous') }}</a>
		</template>
		<template #column2>
			<div class="hidden lg:flex items-start lg:justify-center">
				<div
					class="relative bg-white shadow-md rounded-2xl p-4 after:absolute after:-bottom-[1.2rem] after:right-[10%] after:border-[1.25em] after:border-solid after:border-transparent after:border-t-white after:border-b-0 after:border-r-0 after:drop-shadow-md"
				>
					<div class="flex my-4 justify-center">
						<H1 class="text-xl xl:text-2xl !text-black mr-2">Download</H1>
						<img class="h-[1.75rem]" src="../../assets/yivi-logo.svg" alt="Yivi" />
					</div>
					<DownloadLinks class="justify-center"></DownloadLinks>
				</div>
				<div class="relative right-16 -mr-16 top-56 mb-56 flex min-w-60">
					<img src="../../assets/mascot-yivi-app-small.svg" alt="PubHubs mascot with Yivi app" />
				</div>
			</div>
			<div class="lg:hidden -mt-8">
				<img class="relative left-1/2 md:left-3/4 -mb-12 w-40 pb-4" src="../../assets/mascot-yivi-app-small.svg" />
			</div>
		</template>
	</OnboardingTemplate>
</template>

<script setup lang="ts">
	import { ref } from 'vue';

	const checked = ref(false);
</script>
