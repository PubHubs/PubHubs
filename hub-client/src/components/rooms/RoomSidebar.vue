<template>
	<div class="bg-surface-background shrink-0 overflow-hidden" :class="[sidebarClasses, { 'transition-all duration-300 ease-in-out': !sidebar.skipTransition.value }]" :style="sidebarStyle">
		<!-- Only render content when open to prevent layout issues -->
		<template v-if="isOpen">
			<!-- Content Area -->
			<div class="h-full overflow-y-auto">
				<slot></slot>
			</div>
		</template>
	</div>
</template>

<script setup lang="ts">
	//  Packages
	import { computed } from 'vue';

	// Composables
	import { SidebarTab, useSidebar } from '@hub-client/composables/useSidebar';

	const props = defineProps<{
		activeTab: SidebarTab;
		isMobile: boolean;
	}>();

	const sidebar = useSidebar();
	const isOpen = computed(() => props.activeTab !== SidebarTab.None);

	// DM sidebar takes more space (100% - 412px) to show conversation
	const isDMSidebar = computed(() => props.activeTab === SidebarTab.DirectMessage || props.activeTab === SidebarTab.NewDM);

	const sidebarClasses = computed(() => {
		if (props.isMobile) {
			return isOpen.value ? 'fixed inset-y-0 right-0 z-50 w-[calc(50vw_+_40px)]' : 'fixed inset-y-0 right-0 z-50 w-0';
		}
		if (!isOpen.value) {
			return 'relative z-40 w-0 border-l-0';
		}
		// DM sidebar uses dynamic width via style, regular sidebar uses fixed width
		return isDMSidebar.value ? 'border-on-surface-disabled relative z-40 border-l' : 'border-on-surface-disabled relative z-40 w-[412px] border-l';
	});

	const sidebarStyle = computed(() => {
		// Only apply dynamic width for DM sidebar on desktop when open
		if (!props.isMobile && isOpen.value && isDMSidebar.value) {
			return { width: 'calc(100% - 412px)' };
		}
		return {};
	});
</script>
