<template>
	<Story title="Forms/FormObjectInput">
		<Label>FormObjectInput</Label>
		<FormObjectInput :template="template" v-model="items"> </FormObjectInput>
		<H2>Result:</H2>
		{{ items }}
	</Story>
</template>

<script setup lang="ts">
	import { ref } from 'vue';
	import { FormObjectInputTemplate } from '@/composables/useFormInputEvents';
	import FormObjectInput from '@/components/forms/FormObjectInput.vue';

	const template: Array<FormObjectInputTemplate> = [
		{ key: 'text', label: 'Tekst', type: 'text', default: '' },
		{ key: 'values', label: 'Values', type: 'textarea', default: '' },
		{ key: 'onoff', label: 'Aan/Uit', type: 'checkbox', default: false },
		{
			key: 'choice',
			label: 'Keus',
			type: 'select',
			options: [
				{ label: 'Een', value: '1' },
				{ label: 'Twee', value: '2' },
				{ label: 'Drie', value: '3' },
			],
			default: '1',
		},
	];

	const items = ref([]);
</script>
