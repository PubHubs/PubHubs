<template>
	<div class="border-on-surface-disabled flex h-[80px] w-full items-center justify-between gap-2 border-b">
		<!-- Close button -->
		<button class="hover:bg-surface-variant rounded-md px-4 transition-colors" :aria-label="$t('global.close')" @click="emit('close')">
			<Icon :type="isMobile ? 'arrow-left' : 'arrow-right'" size="base" />
		</button>

		<!-- Tab buttons -->
		<div class="flex flex-1 items-center justify-end gap-1 pr-8">
			<!-- Library tab (Room only) -->
			<GlobalBarButton
				v-if="showLibraryTab && isRoomSidebar"
				type="folder-simple"
				class="rounded-md p-2 transition-colors"
				:selected="activeTab === SidebarTab.Library"
				:aria-label="$t('rooms.library')"
				@click="emit('tabChange', SidebarTab.Library)"
			/>

			<!-- Members tab (Room only) -->
			<GlobalBarButton v-if="isRoomSidebar" type="users" :selected="activeTab === SidebarTab.Members" :aria-label="$t('rooms.members')" @click="emit('tabChange', SidebarTab.Members)" />

			<!-- Search tab (Room only) -->
			<GlobalBarButton v-if="isRoomSidebar" type="magnifying-glass" :aria-label="$t('rooms.search')" :selected="activeTab === SidebarTab.Search" @click="emit('tabChange', SidebarTab.Search)" />

			<!-- Thread tab (Room only, shown when active) -->
			<GlobalBarButton v-if="activeTab === SidebarTab.Thread" type="chat-circle" :aria-label="$t('rooms.thread')" :selected="activeTab === SidebarTab.Thread" />

			<!-- DM tab indicator (DirectMessage only) -->
			<GlobalBarButton v-if="activeTab === SidebarTab.DirectMessage" type="chat-circle" :aria-label="$t('menu.directmsg')" :selected="activeTab === SidebarTab.DirectMessage" />

			<!-- NewDM tab indicator (DirectMessage only) -->
			<GlobalBarButton v-if="activeTab === SidebarTab.NewDM" type="plus" :aria-label="$t('others.new_message')" :selected="activeTab === SidebarTab.NewDM" />
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed } from 'vue';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import GlobalBarButton from '@hub-client/components/ui/GlobalbarButton.vue';

	// Composables
	import { SidebarTab } from '@hub-client/composables/useSidebar';

	// Stores
	import { FeatureFlag, useSettings } from '@hub-client/stores/settings';

	const settings = useSettings();

	const props = defineProps<{
		activeTab: SidebarTab;
		isMobile: boolean;
	}>();

	const emit = defineEmits<{
		(e: 'close'): void;
		(e: 'tabChange', tab: SidebarTab): void;
	}>();

	const showLibraryTab = computed(() => settings.isFeatureEnabled(FeatureFlag.roomLibrary));

	// Determine if this is a Room sidebar (has Library, Members, Search tabs)
	// or a DirectMessage sidebar (has DM, NewDM tabs)
	const isRoomSidebar = computed(() => {
		return props.activeTab === SidebarTab.Library || props.activeTab === SidebarTab.Members || props.activeTab === SidebarTab.Search || props.activeTab === SidebarTab.Thread;
	});
</script>
