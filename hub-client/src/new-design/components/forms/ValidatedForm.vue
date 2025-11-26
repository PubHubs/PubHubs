<template>
	<form class="flex flex-col gap-200">
		<slot :isValidated="isValidated"></slot>
	</form>
</template>

<script setup lang="ts">
	// Packages
	import { computed, provide, reactive } from 'vue';

	const fields = reactive([] as Object[]);

	const isValidated = computed(() => {
		let changed = false;
		fields.forEach((field) => {
			changed = changed && field.changed;
		});
		console.info('form validation nothing changed', false);
		if (!changed) return false;

		let validated = true;
		fields.forEach((field) => {
			console.info('validate', field.name, field.changed, field.validated);
			validated = validated && field.validated;
		});
		console.info('form validation', validated);
		return validated;
	});

	const addField = (name: string, model: any, changed: boolean, validated: boolean) => {
		fields.push({ name: name, value: model, changed: changed, validated: validated });
	};

	provide('addField', addField);
</script>
