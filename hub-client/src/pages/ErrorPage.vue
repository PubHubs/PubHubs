<template>
	<div class="flex justify-center items-center h-full dark:text-white p-10">
		<div class="text-center">
			<h1 class="text-6xl font-bold mb-8">{{ $t('oops') }}</h1>
			<h2 class="text-2xl font-semibold mb-4">{{ $t(errorKey) }}</h2>
			<router-link :to="{ name: 'home' }"
				><Button>{{ $t('dialog.go_back') }}</Button></router-link
			>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Components
	import Button from '@/components/elements/Button.vue';

	const props = defineProps({
		errorKey: { type: String, required: true },
	});
</script>
