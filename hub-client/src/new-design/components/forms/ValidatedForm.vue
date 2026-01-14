<template>
	<form class="relative flex flex-col gap-200">
		<div v-if="disabled" class="absolute z-50 h-full w-full cursor-not-allowed"></div>
		<slot :isValidated="isValidated" :isDisabled="disabled"></slot>
	</form>
</template>

<script setup lang="ts">
	// Packages
	import { computed, provide, ref } from 'vue';

	const emit = defineEmits(['validated']);

	// Props
	const props = withDefaults(
		defineProps<{
			disabled?: boolean;
		}>(),
		{
			disabled: false,
		},
	);

	type fieldType = {
		name: string;
		model: any;
		changed: boolean;
		validated: boolean;
	};

	const fields = ref([] as fieldType[]);

	const isValidated = computed(() => {
		let changed = false;
		let validated = true;
		fields.value.forEach((field) => {
			changed = changed || field.changed;
		});
		fields.value.forEach((field) => {
			validated = validated && field.validated;
		});
		if (!changed || fields.value.length === 0) {
			validated = false;
		}
		emit('validated', validated);
		return validated;
	});

	const addField = (name: string, model: any, changed: boolean, validated: boolean) => {
		let tmpFields = [...fields.value];
		tmpFields.push({ name: name, model: model, changed: changed, validated: validated } as fieldType);
		fields.value = tmpFields;
	};

	provide('addField', addField);
</script>
