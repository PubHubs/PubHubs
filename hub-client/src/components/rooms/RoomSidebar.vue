<template>
	<div
		class="flex h-full shrink-0 flex-col overflow-hidden transition-all duration-300 ease-in-out"
		:class="[isMobile ? (isOpen ? 'fixed inset-0 z-50 w-screen' : 'fixed inset-0 z-50 w-0') : isOpen ? 'border-on-surface-disabled relative z-40 w-[412px] border-l' : 'relative z-40 w-0 border-l-0']"
	>
		<!-- Only render content when open to prevent layout issues -->
		<template v-if="isOpen">
			<!-- Sidebar Header with Tabs -->
			<RoomSidebarHeader :active-tab="activeTab" :is-mobile="isMobile" @close="emit('close')" @tab-change="emit('tabChange', $event)" />

			<!-- Content Area -->
			<div class="flex-1 overflow-y-auto">
				<slot></slot>
			</div>
		</template>
	</div>
</template>

<script setup lang="ts">
	import { computed } from 'vue';

	import RoomSidebarHeader from '@hub-client/components/rooms/RoomSidebarHeader.vue';

	import { SidebarTab } from '@hub-client/composables/useSidebar';

	const props = defineProps<{
		activeTab: SidebarTab;
		isMobile: boolean;
	}>();

	const emit = defineEmits<{
		(e: 'close'): void;
		(e: 'tabChange', tab: SidebarTab): void;
	}>();

	const isOpen = computed(() => props.activeTab !== SidebarTab.None);
</script>
