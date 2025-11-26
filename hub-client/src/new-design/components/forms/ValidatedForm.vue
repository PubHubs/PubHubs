<template>
	<form class="border-accent-blue flex flex-col gap-100 border p-200">
		<slot :isValidated="isValidated"></slot>
	</form>
</template>

<script setup lang="ts">
	// Packages
	import { computed, provide, reactive } from 'vue';

	const fields = reactive([] as Object[]);

	const isValidated = computed(() => {
		let validated = true;
		fields.forEach((field) => {
			validated = field.validated && field;
		});
		return validated;
	});

	const addField = (model: any, validated: boolean) => {
		fields.push({ value: model.value, validated: validated });
	};

	provide('addField', addField);
</script>
