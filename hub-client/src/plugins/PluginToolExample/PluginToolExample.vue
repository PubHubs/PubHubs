<template>
	<HeaderFooter class="pl-3">
		<template #header>
			<H1 class="text-blue m-0 font-bold">Tool</H1>
		</template>

		<H2>Example Plugin</H2>
		<p>Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat.</p>
	</HeaderFooter>
</template>

<script setup lang="ts">
	// Components
	import H1 from '@hub-client/components/elements/H1.vue';
	import H2 from '@hub-client/components/elements/H2.vue';
	import HeaderFooter from '@hub-client/components/ui/HeaderFooter.vue';
</script>
