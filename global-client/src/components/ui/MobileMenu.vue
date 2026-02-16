<template>
	<div v-if="shouldShowScrollBack && isMobile && !global.isModalVisible" class="absolute top-0 left-0 flex h-[80px] items-center p-4 select-none" @click="handleBackClick()">
		<Icon type="arrow-left" class="stroke-0 hover:cursor-pointer" />
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed, onMounted, onUnmounted, ref } from 'vue';

	// Stores
	import { useGlobal } from '@global-client/stores/global';

	import { Message, MessageType, iframeHubId, useMessageBox } from '@hub-client/stores/messagebox';
	import { useSettings } from '@hub-client/stores/settings';

	const global = useGlobal();
	const settings = useSettings();
	const messagebox = useMessageBox();
	const isMobile = computed(() => settings.isMobileState);
	const shouldShowScrollBack = ref(false);

	const handleBackClick = () => {
		// Send message to hub-client to close the sidebar (if open) or scroll (if closed)
		messagebox.sendMessage(new Message(MessageType.CloseSidebar), iframeHubId);
	};

	const updateScrollVisibility = () => {
		const layoutRoot = document.getElementById('layout-root');
		if (layoutRoot) {
			const scrollLeft = layoutRoot.scrollLeft;
			const threshold = layoutRoot.scrollWidth / 2 - 5;
			shouldShowScrollBack.value = scrollLeft >= threshold;
		}
	};

	onMounted(() => {
		const layoutRoot = document.getElementById('layout-root');
		if (layoutRoot) {
			layoutRoot.addEventListener('scroll', updateScrollVisibility);
			updateScrollVisibility();
		}
	});

	onUnmounted(() => {
		const layoutRoot = document.getElementById('layout-root');
		if (layoutRoot) {
			layoutRoot.removeEventListener('scroll', updateScrollVisibility);
		}
	});
</script>
