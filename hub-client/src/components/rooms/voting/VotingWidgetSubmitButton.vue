<template>
	<div class="flex justify-end p-2">
		<Button :disabled="disabled" @click="submit()">{{ $t(buttonText) }}</Button>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed } from 'vue';

	const emit = defineEmits(['send', 'edit']);
	const props = defineProps<{ disabled: boolean; isEdit: boolean }>();

	const buttonText = computed(() => {
		if (props.isEdit) {
			return 'forms.save';
		}
		return 'forms.submit';
	});

	const submit = () => {
		if (props.isEdit) {
			emit('edit');
		} else {
			emit('send');
		}
	};
</script>
