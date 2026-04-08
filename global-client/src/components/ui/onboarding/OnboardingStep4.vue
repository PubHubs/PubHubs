<template>
	<OnboardingTemplate>
		<template #column1>
			<Progressbar :current-step="2" />
			<OnboardingTitle />
			<p>
				<b>{{ $t('others.step', [2]) }}</b>
				&nbsp; {{ $t('register.overview_step2') }}.
			</p>
			<p class="mt-4 mb-2">
				{{ $t('register.rewards.good_job') }}
			</p>
			<p class="my-2">
				{{ $t('register.data_request') }}
			</p>
			<p class="my-2">
				{{ $t('register.data_add') }}
			</p>
			<Foldout :question="`${$t('register.data_add_how')}`">
				{{ $t('register.data_add_how_answer') }}
			</Foldout>
			<Foldout :question="`${$t('register.data_why')}`">
				{{ $t('register.data_why_answer') }}
			</Foldout>
			<label
				class="mt-6 flex font-bold"
				for="attributesAdded"
			>
				<Checkbox
					id="attributesAdded"
					v-model="checked"
					class="mt-1 mr-2 h-[16px] w-[16px] md:mt-1"
					:color="'blue'"
				/>
				{{ $t('register.data_added') }}
			</label>
			<Button
				class="my-4 w-fit"
				:disabled="!checked"
				@click="$emit('next')"
			>
				{{ $t('register.step_go_to', [3]) }} &#x27F6;
			</Button>
			<a
				class="text-label mt-4 underline underline-offset-4"
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
			<div class="-mt-8 lg:hidden">
				<img
					class="relative left-1/2 -mb-20 w-40 pb-4 md:left-3/4"
					src="../../../assets/mascot-yivi-app-small.svg"
				/>
			</div>
		</template>
	</OnboardingTemplate>
</template>

<script lang="ts" setup>
	// Packages
	import { ref } from 'vue';

	defineEmits(['next', 'back']);

	const checked = ref(false);
</script>
