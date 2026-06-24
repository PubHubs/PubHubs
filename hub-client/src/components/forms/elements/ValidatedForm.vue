<template>
	<form
		class="validated-form relative flex flex-col gap-100"
		:class="isValidated ? 'validated' : ''"
	>
		<slot :is-validated="isValidated" />
	</form>
</template>

<script lang="ts">
	// Types
	type FieldType = {
		fieldId: string;
		changed: boolean;
		model: unknown;
		name: string;
		validated: boolean;
	};
</script>

<script lang="ts" setup>
	// Packages
	import { computed, provide, ref } from 'vue';

	// Props
	const props = withDefaults(
		defineProps<{
			disabled?: boolean;
		}>(),
		{
			disabled: false,
		},
	);

	// Lifecycle
	const emit = defineEmits<{
		(e: 'validated', value: boolean): void;
	}>();

	const fields = ref<FieldType[]>([]);

	// Computed
	const isValidated = computed(() => {
		if (props.disabled) return false;
		const changed = fields.value.some((field) => field.changed);
		const validated = fields.value.every((field) => field.validated);
		const result = changed && fields.value.length > 0 && validated;
		emit('validated', result);
		return result;
	});

	const addField = (fieldId: string, name: string, model: unknown, changed: boolean, validated: boolean) => {
		fields.value = [...fields.value, { fieldId, name, model, changed, validated }];
	};

	const removeField = (fieldId: string) => {
		fields.value = fields.value.filter((field) => field.fieldId !== fieldId);
	};

	const resetForm = () => {
		fields.value.forEach((f) => {
			f.changed = false;
		});
	};

	provide('addField', addField);
	provide('removeField', removeField);
	provide('formDisabled', props.disabled);

	defineExpose({ resetForm });
</script>
