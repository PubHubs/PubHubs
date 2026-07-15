<template>
	<OnboardingTemplate>
		<template #column1>
			<Progressbar :current-step="2" />
			<OnboardingTitle />
			<p>
				<b>{{ $t('others.step', [2]) }}</b>
				&nbsp; {{ $t('register.overview_step2') }}.
			</p>
			<p class="mt-200 mb-100">
				{{ $t('register.rewards.good_job') }}
			</p>
			<p class="my-100">
				{{ $t('register.data_request') }}
			</p>
			<p class="my-100">
				{{ $t('register.data_add') }}
			</p>
			<Foldout :question="`${$t('register.data_add_how')}`">
				{{ $t('register.data_add_how_answer') }}
			</Foldout>
			<Foldout :question="`${$t('register.data_why')}`">
				{{ $t('register.data_why_answer') }}
			</Foldout>
			<Checkbox
				id="attributesAdded"
				v-model="checked"
				class="mt-050 md:mt-050 mr-100 h-[16px] w-[16px]"
			>
				{{ $t('register.data_added') }}
			</Checkbox>
			<Button
				class="my-200 w-fit"
				:disabled="!checked"
				@click="$emit('next')"
			>
				{{ $t('register.step_go_to', [3]) }} &#x27F6;
			</Button>
			<a
				class="text-label mt-200 underline underline-offset-4"
				href="javascript:void(0)"
				@click="$emit('back')"
				>&#x27F5; {{ $t('register.step_previous') }}</a
			>
		</template>
		<template #column2>
			<div class="hidden justify-center lg:flex">
				<div class="w-3/4">
					<img
						alt="PubHubs mascot with attributes"
						src="../../../assets/mascot-attributes.svg"
					/>
				</div>
			</div>
			<div class="-mt-400 lg:hidden">
				<img
					class="relative left-1/2 -mb-800 w-2000 pb-200 md:left-3/4"
					src="../../../assets/mascot-yivi-app-small.svg"
				/>
			</div>
		</template>
	</OnboardingTemplate>
</template>

<script lang="ts" setup>
	// Packages
	import { ref } from 'vue';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import Checkbox from '@hub-client/components/forms/elements/Checkbox.vue';

	defineEmits(['next', 'back']);

	const checked = ref(false);
</script>
