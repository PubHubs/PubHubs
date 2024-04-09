<template>
	<div class="flex flex-col h-full md:mt-0 mt-16 xl:max-w-screen-xl m-auto p-5 gap-8">
		<div class="flex flex-col w-full">
			<H3>{{ $t('rooms.latest_news') }}</H3>
			<div class="flex flex-col md:flex-row justify-between gap-4">
				<ArticleBlock>
					<template #header>Relevante video titel</template>
					<template #category>{{ $t('rooms.watch') }}</template>
					<template #content>Video | 20-12-2022</template>
				</ArticleBlock>
				<ArticleBlock>
					<template #header>Artikel over iets leuks</template>
					<template #category>{{ $t('rooms.read') }}</template>
					<template #content>Artikel - 28 November</template>
				</ArticleBlock>
				<ArticleBlock>
					<template #header>Voorbeeld hub meetup 2022</template>
					<template #category>{{ $t('rooms.event') }}</template>
					<template #content>9 december, Goffertpark Nijmegen</template>
				</ArticleBlock>
			</div>
			<div class="flex justify-end mt-4">
				<button class="dark:bg-gray-dark rounded-md px-3 tracking-wide">{{ $t('rooms.more_news') }} →</button>
			</div>
		</div>
		<div class="relative right-1/2 md:right-0 focus-within:right-4 md:focus-within:right-0 transition-all duration-200 p-6 md:p-0 w-full mx-auto">
			<SearchInput></SearchInput>
		</div>
		<div>
			<H3>{{ $t('rooms.popular_rooms') }}</H3>
			<div class="flex flex-col gap-4">
				<div class="flex flex-col md:flex-row justify-between gap-4">
					<ArticleBlock>
						<template #header>Smartphones en jonge kinderen</template>
						<template #category>{{ $t('rooms.discussion') }}</template>
						<template #content>20-12-2022</template>
					</ArticleBlock>
					<ArticleBlock>
						<template #header>Voorbeeld discussie</template>
						<template #category>{{ $t('rooms.discussion') }}</template>
						<template #content>20-12-2022</template>
					</ArticleBlock>
					<ArticleBlock>
						<template #header>Voorbeeld room</template>
						<template #category>{{ $t('rooms.discussion') }}</template>
						<template #content>20-12-2022</template>
					</ArticleBlock>
				</div>
				<div class="flex flex-col md:flex-row justify-between gap-4">
					<ArticleBlock>
						<template #header>Smartphones en jonge kinderen</template>
						<template #category>{{ $t('rooms.discussion') }}</template>
						<template #content>20-12-2022</template>
					</ArticleBlock>
					<ArticleBlock>
						<template #header>Voorbeeld discussie</template>
						<template #category>{{ $t('rooms.discussion') }}</template>
						<template #content>20-12-2022</template>
					</ArticleBlock>
					<ArticleBlock>
						<template #header>Voorbeeld room</template>
						<template #category>{{ $t('rooms.discussion') }}</template>
						<template #content>20-12-2022</template>
					</ArticleBlock>
				</div>
			</div>
			<div class="flex justify-end py-4">
				<button class="dark:bg-gray-dark rounded-md px-3 tracking-wide">{{ $t('rooms.more_suggestions') }} →</button>
			</div>
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
