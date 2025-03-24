<template>
	<div v-if="!($route.name === 'onboarding')" :class="classObject" class="absolute left-0 top-0 flex h-16 items-center p-4 md:hidden" @click="toggleMenu.toggleMenuAndSendToHub()">
		<Icon v-if="!toggleMenu.globalIsActive && !global.isModalVisible" type="arrow" class="stroke-0" />
	</div>
</template>

<script setup lang="ts">
	import { useGlobal } from '@/logic/store/global';
	import { useToggleMenu } from '@/logic/store/toggleGlobalMenu';
	import { computed } from 'vue';

	const toggleMenu = useToggleMenu();
	const global = useGlobal();

	const classObject = computed(() => ({
		hidden: toggleMenu.globalIsActive,
		'h-16 w-16': !toggleMenu.globalIsActive && !global.isModalVisible,
	}));
</script>
