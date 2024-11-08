<template>
	<div class="flex flex-row justify-between items-center my-4 mx-6 md:m-9">
		<router-link to="/">
			<Logo class="h-4 md:h-8" :global="true"></Logo>
		</router-link>
		<div class="flex flex-row items-center gap-2 md:gap-8">
			<div class="grid grid-cols-2 divide-x-2 divide-black auto-rows-min items-center">
				<p class="px-2 font-bold md:text-xl cursor-pointer hover:text-gray" @click="changeLanguage('nl')">NL</p>
				<p class="px-2 font-bold md:text-xl cursor-pointer hover:text-gray" @click="changeLanguage('en')">EN</p>
			</div>
		</div>
	</div>
	<component class="text-lg" :is="`OnboardingStep${props.onboardingStep}`" @next="next(1)" @skip="next(2)" @back="back"> </component>
	<div class="lg:hidden w-full h-12 bg-gray-dark"></div>
</template>

<script setup lang="ts">
	import { useSettings } from '@/store/settings';
	import { useRouter } from 'vue-router';

	const settings = useSettings();
	const router = useRouter();

	const props = defineProps({
		onboardingStep: {
			// Start at the second step of the onboarding wizard when the user goes to /register
			default: 2,
			required: true,
			type: Number,
		},
	});

	function next(n: Number) {
		const next = props.onboardingStep + Number(n);
		router.push(`/register/${next}`);
	}

	function back() {
		router.go(-1);
	}

	function changeLanguage(language: string) {
		settings.setLanguage(language, true);
	}
</script>
