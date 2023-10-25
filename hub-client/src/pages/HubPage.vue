<template>
	<div class="h-full flex flex-col w-full overflow-hidden">
		<div class="h-36 overflow-hidden relative">
			<div class="bg-white w-20 h-20 rounded-full absolute -ml-5 -mt-5 md:hidden"></div>
			<H1 class="mt-12 ml-12 absolute text-white">Voorbeeld hubpage</H1>
			<ImagePlaceholder src="img/imageplaceholder.jpg"></ImagePlaceholder>
		</div>

		<div class="px-9 pt-9 max-w-7xl mx-auto">
			<H2>Over de voorbeeldhub</H2>
			<div class="flex flex-col md:flex-row md:justify-between md:gap-x-4 md:mb-16">
				<div class="flex flex-col md:basis-1/3 md:pr-2">
					<p>
						Lorem ipsum dolor sit amet, consectetur adipiscing elit. Lectus fermentum diam, mi blandit ornare quam eu dolor. Neque, risus ut eget sit sit neque eu in. Nibh sociis eu sapien augue. Integer proin interdum lacus,
						ornare quam facilisi.
					</p>
					<Button class="w-fit mt-4 text-xs md:text-base" @click="login()">Doe mee met Voorbeeld hub!</Button>
				</div>

				<div class="flex flex-col gap-y-7 my-14 md:contents">
					<ArticleBlock>
						<template #header>ChatGPT en het onderwijs</template>
						<template #category>Room</template>
						<template #content>De description tekst is altijd maar zo breed, dan past de knop</template>
					</ArticleBlock>
					<ArticleBlock>
						<template #header>Dit is hoe een langere titel eruit gaat zien</template>
						<template #category>Room</template>
						<template #content>Het witte gedeelte schaalt mee met de titel hoogte.</template>
					</ArticleBlock>
				</div>
			</div>

			<div class="pb-2">
				<div class="flex flex-col gap-y-4 md:gap-y-0 md:flex-row justify-between md:gap-x-8 mb-4">
					<Pill>
						<template #header>ChatGPT en het onderwijs</template>
						<template #content>De description tekst is altijd maar zo breed, dan past de knop</template>
					</Pill>
					<Pill>
						<template #header>ChatGPT en het onderwijs</template>
						<template #content>De description tekst is altijd maar zo breed, dan past de knop</template>
					</Pill>
					<Pill>
						<template #header>Dit is hoe een langere titel eruit gaat zien</template>
						<template #content>Het witte gedeelte schaalt mee met de titel hoogte.</template>
					</Pill>
				</div>
				<div class="flex flex-col gap-y-4 md:gap-y-0 md:flex-row md:justify-between md:gap-x-8">
					<Pill>
						<template #header>ChatGPT en het onderwijs</template>
						<template #content>De description tekst is altijd maar zo breed, dan past de knop</template>
					</Pill>
					<Pill>
						<template #header>ChatGPT en het onderwijs</template>
						<template #content>De description tekst is altijd maar zo breed, dan past de knop</template>
					</Pill>
					<Pill>
						<template #header>Dit is hoe een langere titel eruit gaat zien</template>
						<template #content>Het witte gedeelte schaalt mee met de titel hoogte.</template>
					</Pill>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	/**
	 *
	 * This HUB page will be shown if a user is not yet registered or authenticated in PubHubs Central.
     * And must show at least one button where a user can goto the PubHubs central login page.
	 *
	 */

	import { usePubHubs } from '@/core/pubhubsStore';
	const pubhubs = usePubHubs();

	function login() {
		pubhubs.centralLogin();
	}
</script>
