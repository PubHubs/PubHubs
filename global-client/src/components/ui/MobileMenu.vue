<template>
	<div v-if="!($route.name === 'onboarding')" :class="[classObject, !isMobile && 'hidden']" class="absolute left-0 top-0 flex items-center" @click="toggleMenu.toggleMenuAndSendToHub()">
		<Icon v-if="!toggleMenu.globalIsActive && !global.isModalVisible" type="dots-three-vertical" size="xl" />
	</div>
</template>

<script setup lang="ts">
	// Vue imports
	import { computed } from 'vue';

	// Global imports
	import { useGlobal } from '@/logic/store/global';
	import { useToggleMenu } from '@/logic/store/toggleGlobalMenu';
	import { useSettings } from '@/logic/store/settings';

	const toggleMenu = useToggleMenu();
	const global = useGlobal();
	const settings = useSettings();
	const isMobile = computed(() => settings.isMobileState);

	const classObject = computed(() => ({
		hidden: toggleMenu.globalIsActive,
		'h-16 w-16': !toggleMenu.globalIsActive && !global.isModalVisible,
	}));
</script>
