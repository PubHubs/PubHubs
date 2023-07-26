<template>
	<Story title="UI/Logo">
		<Logo :theme="state.theme"></Logo>
		<template #controls>
			<HstButtonGroup v-model="state.theme" title="Theme" :options="themes" />
		</template>
	</Story>
</template>

<script setup lang="ts">
	import { reactive } from 'vue';
	import Logo from '@/components/ui/Logo.vue';

	const themes = ['light', 'dark'];

	const state = reactive({
		theme: 'light',
	});
</script>
