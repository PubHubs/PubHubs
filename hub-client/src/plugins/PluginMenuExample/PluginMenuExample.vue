<template>
	<HeaderFooter class="pl-3">
		<template #header>
			<H1 class="text-blue m-0 font-bold">{{ $t('plugin-example.page.title') }}</H1>
		</template>

		<H2>{{ $t('plugin-example.page.subtitle') }}</H2>
		<p>{{ $t('plugin-example.page.text') }}</p>
	</HeaderFooter>
</template>

<script setup lang="ts">
	// Components
	import H1 from '@hub-client/components/elements/H1.vue';
	import H2 from '@hub-client/components/elements/H2.vue';
	import HeaderFooter from '@hub-client/components/ui/HeaderFooter.vue';
</script>
