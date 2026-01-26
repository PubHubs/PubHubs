<template>
	<div class="border-on-surface-disabled flex h-[80px] w-full items-center justify-between gap-2 border-b p-8">
		<!-- Close button -->
		<button class="hover:bg-surface-variant rounded-md p-2 transition-colors" :aria-label="$t('global.close')" @click="emit('close')">
			<Icon :type="isMobile ? 'arrow-left' : 'x'" size="base" />
		</button>

		<!-- Tab buttons -->
		<div class="flex flex-1 items-center justify-end gap-1">
			<!-- Library tab (Room only) -->
			<button
				v-if="showLibraryTab && isRoomSidebar"
				class="rounded-md p-2 transition-colors"
				:class="activeTab === SidebarTab.Library ? 'bg-surface-variant text-accent-primary' : 'hover:bg-surface-variant'"
				:aria-label="$t('rooms.library')"
				@click="emit('tabChange', SidebarTab.Library)"
			>
				<Icon type="folder-simple" size="base" />
			</button>

			<!-- Members tab (Room only) -->
			<button
				v-if="isRoomSidebar"
				class="rounded-md p-2 transition-colors"
				:class="activeTab === SidebarTab.Members ? 'bg-surface-variant text-accent-primary' : 'hover:bg-surface-variant'"
				:aria-label="$t('rooms.members')"
				@click="emit('tabChange', SidebarTab.Members)"
			>
				<Icon type="users" size="base" />
			</button>

			<!-- Search tab (Room only) -->
			<button
				v-if="isRoomSidebar"
				class="rounded-md p-2 transition-colors"
				:class="activeTab === SidebarTab.Search ? 'bg-surface-variant text-accent-primary' : 'hover:bg-surface-variant'"
				:aria-label="$t('rooms.search')"
				@click="emit('tabChange', SidebarTab.Search)"
			>
				<Icon type="magnifying-glass" size="base" />
			</button>

			<!-- Thread tab (Room only, shown when active) -->
			<button v-if="activeTab === SidebarTab.Thread" class="bg-surface-variant text-accent-primary rounded-md p-2 transition-colors" :aria-label="$t('rooms.thread')">
				<Icon type="chats-circle" size="base" />
			</button>

			<!-- DM tab indicator (DirectMessage only) -->
			<button v-if="activeTab === SidebarTab.DirectMessage" class="bg-surface-variant text-accent-primary rounded-md p-2 transition-colors" :aria-label="$t('menu.directmsg')">
				<Icon type="chat-circle" size="base" />
			</button>

			<!-- NewDM tab indicator (DirectMessage only) -->
			<button v-if="activeTab === SidebarTab.NewDM" class="bg-surface-variant text-accent-primary rounded-md p-2 transition-colors" :aria-label="$t('others.new_message')">
				<Icon type="plus" size="base" />
			</button>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { computed } from 'vue';

	import Icon from '@hub-client/components/elements/Icon.vue';

	import { SidebarTab } from '@hub-client/composables/useSidebar';

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
