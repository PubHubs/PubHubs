<template>
	<div class="w-full">
		<Tabs>
			<FormObjectInputContent :template="template" :canAdd="props.canAdd" :canRemove="props.canRemove" v-model="value"> </FormObjectInputContent>
		</Tabs>
	</div>
</template>

<script setup lang="ts">
	// Components
	import Tabs from '../ui/Tabs.vue';
	import FormObjectInputContent from './FormObjectInputContent.vue';

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
		canAdd: {
			type: Boolean,
			required: false,
			default: true,
		},
		canRemove: {
			type: Boolean,
			required: false,
			default: true,
		},
	});

	const value = ref(props.modelValue);
</script>
