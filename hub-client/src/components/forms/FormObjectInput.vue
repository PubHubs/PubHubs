<template>
	<div class="w-full">
		<Tabs>
			<FormObjectInputContent :template="template" v-model="value"> </FormObjectInputContent>
		</Tabs>
	</div>
</template>

<script setup lang="ts">
	import { ref } from 'vue';
	import { FormObjectInputTemplate } from '@/composables/useFormInputEvents';

	// const emit = defineEmits(['input']);

	const props = defineProps({
		template: {
			type: Array<FormObjectInputTemplate>,
			required: true,
		},
		modelValue: {
			type: Array<any>,
			required: true,
		},
	});

	const value = ref(props.modelValue);
</script>
