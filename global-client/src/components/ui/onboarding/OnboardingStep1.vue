<template>
	<OnboardingTemplate>
		<template #column1>
			<div class="flex w-11/12 place-self-center md:w-3/4 lg:w-full">
				<img
					alt="PubHubs mascot"
					src="../../../assets/mascot-welcome.svg"
				/>
			</div>
		</template>
		<template #column2>
			<div class="mb-500 flex justify-center">
				<div class="flex flex-col items-center lg:items-start">
					<H1>{{ $t('register.welcome') }}</H1>
					<Button
						class="mt-300"
						@click="emit('next')"
					>
						{{ $t('register.register') }}
					</Button>
				</div>
			</div>
		</template>
	</OnboardingTemplate>
</template>

<script lang="ts" setup>
	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import H1 from '@hub-client/components/elements/H1.vue';

	const emit = defineEmits(['next']);
</script>
