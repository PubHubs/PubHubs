<template>
	<div v-if="!($route.name === 'onboarding')" :class="classObject" class="centered absolute top-0 left-0" @click="toggleMenu.toggleMenuAndSendToHub()">
		<div class="centered" :class="{ 'w-14 h-14 bg-white hover:bg-lightgray-light rounded-xl': toggleMenu.globalIsActive }">
			<Icon v-if="toggleMenu.globalIsActive" size="lg" type="arrow" class="stroke-0 text-black"></Icon>
			<Icon v-else-if="!toggleMenu.globalIsActive && !global.isModalVisible" type="hamburger" class="stroke-0 text-ph-text"></Icon>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { useGlobal } from '@/store/global';
	import { useToggleMenu } from '@/store/toggleGlobalMenu';
	import { computed } from 'vue';

	const toggleMenu = useToggleMenu();
	const global = useGlobal();

	const classObject = computed(() => ({
		'h-24 w-24 dark:bg-ph-background-5 bg-ph-background-4': toggleMenu.globalIsActive,
		'h-16 w-16': !toggleMenu.globalIsActive && !global.isModalVisible,
	}));
</script>

<style scoped>
	.centered {
		@apply grid 2md:hidden items-center justify-center;
	}
</style>
