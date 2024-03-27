<template>
	<div v-if="Object.keys(errors).length > 0" class="rounded-lg bg-red-dark text-white p-2 mt-2">
		<div v-for="(error, index) in errors" :key="index">
			{{ $t(error.error, [error.field, error.param]) }}
		</div>
	</div>
</template>

<script setup lang="ts">
	import { ValidationErrors } from '@/composables/useFormState';

	defineProps<{ errors: ValidationErrors }>();
</script>
