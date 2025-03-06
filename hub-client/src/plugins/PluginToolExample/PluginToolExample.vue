<template>
	<HeaderFooter class="pl-3">
		<template #header>
			<H1 class="m-0 font-bold text-blue">Tool</H1>
		</template>

		<H2>Example Plugin</H2>
		<p>Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat.</p>
	</HeaderFooter>
</template>

<script setup lang="ts">
	// Components
	import HeaderFooter from '@/components/ui/HeaderFooter.vue';
	import H1 from '@/components/elements/H1.vue';
	import H2 from '@/components/elements/H2.vue';
</script>
