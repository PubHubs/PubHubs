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

const activeTab = ref<SidebarTab>(SidebarTab.None);
const selectedDMRoom = ref<Room | null>(null);
// Persisted DM room ID - survives close() calls so DM page can restore state
const lastDMRoomId = ref<string | null>(null);
// Flag to disable transitions when closing during navigation
const skipTransition = ref(false);

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

	// Set tab (same as openTab, but clearer intent)
	function setTab(tab: SidebarTab) {
		activeTab.value = tab;
	}

	// Toggle between open/closed for a specific tab
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
		lastDMRoomId.value = room.roomId;
		activeTab.value = SidebarTab.DirectMessage;
	}

	// Restore DM sidebar state - used when returning to DM page
	// Opens last viewed DM room, or most recent if no history
	function restoreDMRoom(sortedRooms: Room[]) {
		// If already showing a DM room, keep it
		if (activeTab.value === SidebarTab.DirectMessage && selectedDMRoom.value) {
			return;
		}

		// Try to restore last viewed DM room
		if (lastDMRoomId.value) {
			const lastRoom = sortedRooms.find((r) => r.roomId === lastDMRoomId.value);
			if (lastRoom) {
				openDMRoom(lastRoom);
				return;
			}
		}

		// Fall back to most recent conversation
		if (sortedRooms.length > 0) {
			openDMRoom(sortedRooms[0]);
		}
	}

	// Close sidebar for room pages (clears active state but preserves DM history)
	function closeForRoomPage() {
		activeTab.value = SidebarTab.None;
		selectedDMRoom.value = null;
	}

	// Close sidebar instantly without animation (used during navigation)
	function closeInstantly() {
		skipTransition.value = true;
		activeTab.value = SidebarTab.None;
		selectedDMRoom.value = null;
		// Reset the flag after a tick so subsequent operations animate normally
		setTimeout(() => {
			skipTransition.value = false;
		}, 0);
	}

	return {
		activeTab: computed(() => activeTab.value),
		selectedDMRoom: computed(() => selectedDMRoom.value),
		skipTransition: computed(() => skipTransition.value),
		isOpen,
		isMobile,
		openTab,
		close,
		setTab,
		toggleTab,
		openDMRoom,
		restoreDMRoom,
		closeForRoomPage,
		closeInstantly,
	};
}
