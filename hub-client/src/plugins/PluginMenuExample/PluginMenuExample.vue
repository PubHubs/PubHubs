<template>
	<HeaderFooter class="pl-3">
		<template #header>
			<H1 class="m-0 font-bold text-blue">{{ $t('plugin-example.page.title') }}</H1>
		</template>

		<H2>{{ $t('plugin-example.page.subtitle') }}</H2>
		<p>{{ $t('plugin-example.page.text') }}</p>
	</HeaderFooter>
</template>

<script setup lang="ts">
	// Components
	import HeaderFooter from '@/components/ui/HeaderFooter.vue';
	import H1 from '@/components/elements/H1.vue';
	import H2 from '@/components/elements/H2.vue';
</script>
