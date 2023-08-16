<template>
	<div v-show="isActiveTab(tab)" class="pt-2">
		<slot></slot>
	</div>
</template>

<script setup lang="ts">
	import { ref, inject, onMounted } from 'vue';

	const registerTab = inject('registerTab') as Function;
	const isActiveTab = inject('isActiveTab') as Function;

	const tab = ref(0);

	onMounted(() => {
		tab.value = registerTab();
	});
</script>
