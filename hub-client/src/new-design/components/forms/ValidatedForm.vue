<template>
	<form class="relative flex flex-col gap-200">
		<slot :isValidated="isValidated"></slot>
	</form>
</template>

<script lang="ts">
	// Types
	type FieldType = {
		changed: boolean;
		model: any;
		name: string;
		validated: boolean;
	};
</script>

<script setup lang="ts">
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

	const fields = ref<FieldType[]>([]);

	// Lifecycle
	const emit = defineEmits<{
		(e: 'validated', value: boolean): void;
	}>();

	// Computed
	const isValidated = computed(() => {
		if (props.disabled) return false;
		const changed = fields.value.some((field) => field.changed);
		const validated = fields.value.every((field) => field.validated);
		const result = changed && fields.value.length > 0 && validated;
		emit('validated', result);
		return result;
	});

	const addField = (name: string, model: any, changed: boolean, validated: boolean) => {
		fields.value = [...fields.value, { name, model, changed, validated }];
	};

	provide('addField', addField);
	provide('formDisabled', props.disabled);
</script>
