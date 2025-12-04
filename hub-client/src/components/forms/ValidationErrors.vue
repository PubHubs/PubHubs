<template>
	<div v-if="Object.keys(errors).length > 0" class="text-red">
		<div v-for="(error, index) in errors" :key="index">
			{{ $t(error.error, [error.field, error.param]) }}
		</div>
	</div>
</template>

<script setup lang="ts">
	// Composables
	import { ValidationErrors } from '@hub-client/composables/useFormState';

	defineProps<{ errors: ValidationErrors }>();
</script>
