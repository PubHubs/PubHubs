<template>
	<div
		class="bg-surface-background shrink-0 overflow-hidden"
		:class="[sidebarClasses, { 'transition-all duration-300 ease-in-out': !sidebar.skipTransition.value }]"
		data-testid="sidebar"
	>
		<!-- Only render content when open to prevent layout issues -->
		<template v-if="isOpen">
			<!-- Content Area -->
			<div class="h-full">
				<slot />
			</div>
		</template>
	</div>
</template>

<script lang="ts" setup>
	//  Packages
	import { computed } from 'vue';

	// Composables
	import { SidebarTab, useSidebar } from '@hub-client/composables/useSidebar';

	// Props
	const props = defineProps<{
		activeTab: SidebarTab;
		isMobile: boolean;
	}>();

	const sidebar = useSidebar();
	const isOpen = computed(() => props.activeTab !== SidebarTab.None);

	const sidebarClasses = computed(() => {
		if (props.isMobile) {
			return isOpen.value
				? 'border-on-surface-disabled fixed top-[80px] bottom-0 right-0 z-50 w-[calc(50vw+40px)] border-l border-on-surface-disabled'
				: 'fixed top-[80px] bottom-0 right-0 z-50 w-0';
		}
		if (!isOpen.value) {
			return 'relative z-40 w-0 border-l-0';
		}

		return 'border-on-surface-disabled relative z-40 w-[360px] 3xl:w-[420px] border-l';
	});
</script>
