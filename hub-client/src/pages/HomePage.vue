<template>
	<div class="flex flex-col h-full xl:max-w-screen-xl m-auto p-5">
		<div class="flex flex-col w-full">
			<H3>Laatste nieuws</H3>
			<div class="flex flex-col md:flex-row justify-between gap-4">
				<ArticleBlock>
					<template #header>Relevante video titel</template>
					<template #category>Kijk</template>
					<template #content>Video | 20-12-2022</template>
				</ArticleBlock>
				<ArticleBlock>
					<template #header>Artikel over iets leuks</template>
					<template #category>Lees</template>
					<template #content>Artikel - 28 November</template>
				</ArticleBlock>
				<ArticleBlock>
					<template #header>Voorbeeld hub meetup 2022</template>
					<template #category>Evenement</template>
					<template #content>9 december, Goffertpark Nijmegen</template>
				</ArticleBlock>
			</div>
			<div class="flex justify-end mt-4">
				<button class="dark:bg-gray-dark rounded-md px-3 tracking-wide">Meer nieuws →</button>
			</div>
		</div>
		<SearchInput class="my-8"></SearchInput>
		<H3>Populaire rooms & discussies</H3>
		<div class="flex flex-col gap-4">
			<div class="flex flex-col md:flex-row justify-between gap-4">
				<ArticleBlock>
					<template #header>Smartphones en jonge kinderen</template>
					<template #category>Discussie</template>
					<template #content>20-12-2022</template>
				</ArticleBlock>
				<ArticleBlock>
					<template #header>Voorbeeld discussie</template>
					<template #category>Discussie</template>
					<template #content>20-12-2022</template>
				</ArticleBlock>
				<ArticleBlock>
					<template #header>Voorbeeld room</template>
					<template #category>Room</template>
					<template #content>20-12-2022</template>
				</ArticleBlock>
			</div>
			<div class="flex flex-col md:flex-row justify-between gap-4">
				<ArticleBlock>
					<template #header>Smartphones en jonge kinderen</template>
					<template #category>Discussie</template>
					<template #content>20-12-2022</template>
				</ArticleBlock>
				<ArticleBlock>
					<template #header>Voorbeeld discussie</template>
					<template #category>Discussie</template>
					<template #content>20-12-2022</template>
				</ArticleBlock>
				<ArticleBlock>
					<template #header>Voorbeeld room</template>
					<template #category>Room</template>
					<template #content>20-12-2022</template>
				</ArticleBlock>
			</div>
		</div>
		<div class="flex justify-end mt-4">
			<button class="dark:bg-gray-dark rounded-md px-3 tracking-wide">Meer suggesties →</button>
		</div>
	</div>
</template>

<script setup lang="ts">
	/**
	 *
	 * This HOME page will be shown if a user is authenticated in PubHubs Central.
	 *
	 */
</script>
