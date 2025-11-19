<template>
	<div class="w-full text-label">
		<Tabs>
			<FormObjectInputContent :template="template" :canAdd="props.canAdd" :canRemove="props.canRemove" v-model="value"> </FormObjectInputContent>
		</Tabs>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { ref } from 'vue';

	// Components
	import FormObjectInputContent from '@hub-client/components/forms/FormObjectInputContent.vue';
	import Tabs from '@hub-client/components/ui/Tabs.vue';

	// Composables
	import { FormObjectInputTemplate } from '@hub-client/composables/useFormInputEvents';

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
