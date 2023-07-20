<template>
	<Story title="Forms/Select">
		<Select :value="options[0].value" :options="options"></Select>
	</Story>
</template>
<script setup lang="ts">
	import Select from '@/components/forms/Select.vue';
	import { Options } from '@/composables/useFormInputEvents';

	const options: Options = [
		{ label: 'Keuze 1', value: 1 },
		{ label: 'Keuze 2', value: 2 },
		{ label: 'Keuze 3', value: 3 },
		{ label: 'Keuze 4', value: 4 },
	];
</script>
