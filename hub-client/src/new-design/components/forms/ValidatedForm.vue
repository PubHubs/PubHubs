<template>
	<form class="flex flex-col gap-200">
		<slot :isValidated="isValidated"></slot>
	</form>
</template>

<script setup lang="ts">
	// Packages
	import { computed, provide, ref } from 'vue';

	type fieldType = {
		name: string;
		model: any;
		changed: boolean;
		validated: boolean;
	};

	const fields = ref([] as fieldType[]);

	const isValidated = computed(() => {
		let changed = true;
		let validated = true;
		fields.value.forEach((field) => {
			changed = changed && field.changed;
		});
		fields.value.forEach((field) => {
			validated = validated && field.validated;
		});
		if (!changed || fields.value.length === 0) {
			validated = false;
		}
		return validated;
	});

	const addField = (name: string, model: any, changed: boolean, validated: boolean) => {
		let tmpFields = [...fields.value];
		tmpFields.push({ name: name, model: model, changed: changed, validated: validated } as fieldType);
		fields.value = tmpFields;
	};

	provide('addField', addField);
</script>
