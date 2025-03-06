<template>
	<div class="mx-6 my-4 flex flex-row items-center justify-between md:m-9">
		<router-link to="/">
			<Logo class="h-4 md:h-8"></Logo>
		</router-link>
		<div class="flex flex-row items-center gap-2 md:gap-8">
			<div class="grid auto-rows-min grid-cols-2 items-center divide-x-2 divide-black">
				<p class="cursor-pointer px-2 font-bold hover:text-gray md:text-xl" @click="changeLanguage('nl')">NL</p>
				<p class="cursor-pointer px-2 font-bold hover:text-gray md:text-xl" @click="changeLanguage('en')">EN</p>
			</div>
		</div>
	</div>
	<component class="text-lg" :is="`OnboardingStep${props.onboardingStep}`" @next="next(1)" @skip="next(2)" @back="back"> </component>
	<div class="h-12 w-full bg-gray-dark lg:hidden"></div>
</template>

<script setup lang="ts">
	import { useSettings } from '@/logic/store/settings';
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
