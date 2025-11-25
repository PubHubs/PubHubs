<template>
	<form class="border-accent-blue flex flex-col gap-100 border p-200">
		<slot :isValidated="isValidated()"></slot>
	</form>
</template>

<script setup lang="ts">
	// Packages
	import { provide, ref } from 'vue';

	const validated = ref(false);
	const scheme = ref([]);

	const isValidated = () => {
		return validated.value;
	};

	const addFieldValidation = () => {};

	provide('isValidated', isValidated);
	provide('addFieldValidation', addFieldValidation);
</script>
