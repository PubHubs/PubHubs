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
			<H3 class="mb-0 mt-4 theme-light:text-black lg:hidden">Download Yivi</H3>
			<DownloadLinks class="mt-2 lg:hidden"></DownloadLinks>
			<label for="yiviDownloaded" class="mt-4 flex font-bold">
				<Checkbox id="yiviDownloaded" class="mr-2 mt-1 h-[16px] w-[16px] sm:mt-0.5" v-model="checked" :color="'blue'"></Checkbox>
				{{ $t('register.yivi_installed') }}
			</label>
			<Button class="mb-4 mt-6 w-fit" :disabled="!checked" @click="$emit('next')">{{ $t('register.step_go_to', [2]) }} &#x27F6;</Button>
			<H3 class="mb-0 mt-4 theme-light:text-black">{{ $t('register.more') }}</H3>
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
						<ol class="my-4 list-outside list-disc pl-4">
							<li>{{ $t('register.yivi_why_central_login') }}</li>
							<li>{{ $t('register.yivi_why_room_login') }}</li>
						</ol>
					</template>
				</i18n-t>
			</Foldout>
			<a href="javascript:void(0)" class="mt-6 text-sm underline underline-offset-4" @click="$emit('back')">&#x27F5; {{ $t('register.step_previous') }}</a>
		</template>
		<template #column2>
			<div class="hidden items-start lg:flex lg:justify-center">
				<div
					class="relative rounded-2xl bg-white p-4 shadow-md after:absolute after:-bottom-[1.2rem] after:right-[10%] after:border-[1.25em] after:border-b-0 after:border-r-0 after:border-solid after:border-transparent after:border-t-white after:drop-shadow-md"
				>
					<div class="my-4 flex justify-center">
						<H1 class="mr-2 text-xl !text-black xl:text-2xl">Download</H1>
						<img class="h-[1.75rem]" src="../../../assets/yivi-logo.svg" alt="Yivi" />
					</div>
					<DownloadLinks class="justify-center"></DownloadLinks>
				</div>
				<div class="relative right-16 top-56 -mr-16 mb-56 flex min-w-60">
					<img src="../../../assets/mascot-yivi-app-small.svg" alt="PubHubs mascot with Yivi app" />
				</div>
			</div>
			<div class="-mt-8 lg:hidden">
				<img class="relative left-1/2 -mb-20 w-40 pb-4 md:left-3/4" src="../../../assets/mascot-yivi-app-small.svg" />
			</div>
		</template>
	</OnboardingTemplate>
</template>

<script setup lang="ts">
	import { ref } from 'vue';

	const checked = ref(false);
</script>
