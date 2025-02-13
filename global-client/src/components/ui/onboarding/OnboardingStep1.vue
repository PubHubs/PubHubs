<template>
	<OnboardingTemplate>
		<template #column1>
			<div class="flex w-11/12 place-self-center sm:w-3/4 lg:w-full">
				<img src="../../../assets/mascot-welcome.svg" alt="PubHubs mascot" />
			</div>
		</template>
		<template #column2>
			<div class="mb-10 flex justify-center">
				<div class="flex flex-col items-center lg:items-start">
					<H1 class="text-3xl theme-light:text-black">{{ $t('register.welcome') }}</H1>
					<Button class="mt-6" @click="$emit('next')">{{ $t('register.register') }}</Button>
				</div>
			</div>
		</template>
	</OnboardingTemplate>
</template>
