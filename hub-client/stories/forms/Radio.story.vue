<template>
	<Story title="Forms/Radio">
		<Radio value="" :options="options"></Radio>
	</Story>
</template>
<script setup lang="ts">
	import Radio from '@/components/forms/Radio.vue';
	import { Options } from '@/composables/useFormInputEvents';

	const options: Options = [
		{ label: 'Keuze 1', value: 1 },
		{ label: 'Keuze 2', value: 2 },
		{ label: 'Keuze 3', value: 3 },
		{ label: 'Keuze 4', value: 4 },
	];
</script>
