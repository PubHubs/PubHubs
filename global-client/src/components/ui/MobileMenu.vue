<template>
	<div v-if="!($route.name === 'onboarding')" :class="[classObject, !isMobile && 'hidden']" class="absolute left-0 top-0 flex h-[7.5rem] items-center p-4" @click="toggleMenu.toggleMenuAndSendToHub()">
		<Icon v-if="!toggleMenu.globalIsActive && !global.isModalVisible" type="list" />
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed } from 'vue';

	// Stores
	import { useGlobal } from '@global-client/stores/global';
	import { useToggleMenu } from '@global-client/stores/toggleGlobalMenu';

	import { useSettings } from '@hub-client/stores/settings';

	const toggleMenu = useToggleMenu();
	const global = useGlobal();
	const settings = useSettings();
	const isMobile = computed(() => settings.isMobileState);

	const classObject = computed(() => ({
		hidden: toggleMenu.globalIsActive,
		'h-16 w-16': !toggleMenu.globalIsActive && !global.isModalVisible,
	}));
</script>
