<template>
	<Story title="UI/Toggler">
		<Toggler>
			<template #title>
				<H2 class="mt-0 dark:text-white">Titel</H2>
			</template>
			<template #content="toggler">
				<Line></Line>
				<p v-if="toggler.state" class="dark:text-white">AAN</p>
				<p v-if="!toggler.state" class="dark:text-white">UIT</p>
			</template>
		</Toggler>
	</Story>
</template>

<script setup lang="ts">
	import Toggler from '@/components/ui/Toggler.vue';
</script>
