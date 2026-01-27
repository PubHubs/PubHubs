// Packages
import { computed, ref } from 'vue';

// Stores
import { Room } from '@hub-client/stores/rooms';
import { useSettings } from '@hub-client/stores/settings';

export enum SidebarTab {
	DirectMessage = 'dm',
	Library = 'library',
	Members = 'members',
	NewDM = 'newdm',
	None = 'none',
	Search = 'search',
	Thread = 'thread',
}

// Module-level state for singleton pattern
const activeTab = ref<SidebarTab>(SidebarTab.None);
const selectedDMRoom = ref<Room | null>(null);

export function useSidebar() {
	const settings = useSettings();
	const isMobile = computed(() => settings.isMobileState);

	// Sidebar visibility
	const isOpen = computed(() => activeTab.value !== SidebarTab.None);

	// Open room specific tab
	function openTab(tab: SidebarTab) {
		activeTab.value = tab;
	}

	// Close sidebar
	function close() {
		activeTab.value = SidebarTab.None;
		selectedDMRoom.value = null;
	}

	// Set tab (same as openTab, but clearer intent for auto-activation like Thread)
	function setTab(tab: SidebarTab) {
		activeTab.value = tab;
	}

	// Toggle between open/closed for a specific tab
	// Used for header buttons that should toggle the sidebar
	function toggleTab(tab: SidebarTab) {
		if (activeTab.value === tab) {
			// If already on this tab, close the sidebar
			close();
		} else {
			// Open or switch to the requested tab
			openTab(tab);
		}
	}

	// Open a DM room in the sidebar
	function openDMRoom(room: Room) {
		selectedDMRoom.value = room;
		activeTab.value = SidebarTab.DirectMessage;
	}

	return {
		activeTab: computed(() => activeTab.value),
		selectedDMRoom: computed(() => selectedDMRoom.value),
		isOpen,
		isMobile,
		openTab,
		close,
		setTab,
		toggleTab,
		openDMRoom,
	};
}
