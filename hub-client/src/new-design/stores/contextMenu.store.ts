// Packages
import { defineStore } from 'pinia';
import { ref } from 'vue';

// Logic
import { createLogger } from '@hub-client/logic/logging/Logger';

// Stores
import { Message, MessageType, useMessageBox } from '@hub-client/stores/messagebox';
import { useSettings } from '@hub-client/stores/settings';

// Models
import type { MenuItem } from '@hub-client/new-design/models/contextMenu.models';

let wheelHandler: ((e: Event) => void) | undefined;

const logger = createLogger('ContextMenu');

export const useContextMenuStore = defineStore('contextMenu', () => {
	// State
	const currentTargetId = ref<string | number | null>(null);
	const isOpen = ref(false);
	const items = ref<MenuItem[]>([]);
	const x = ref(0);
	const y = ref(0);

	// Functions
	function disableWheelScroll() {
		wheelHandler = (e: Event) => e.preventDefault();
		window.addEventListener('wheel', wheelHandler, { passive: false, capture: true });
	}

	function enableWheelScroll() {
		if (wheelHandler) {
			window.removeEventListener('wheel', wheelHandler, { capture: true });
			wheelHandler = undefined;
		}
	}

	function open(newItems: MenuItem[], clientX = 0, clientY = 0, targetId: string | number | null = null) {
		if (!newItems || newItems.length === 0) return;

		items.value = newItems;
		x.value = clientX;
		y.value = clientY;
		currentTargetId.value = targetId;

		const messagebox = useMessageBox();
		const settings = useSettings();

		if (messagebox.inIframe && settings.isMobileState) {
			// The global-client will send back a ContextMenuSelect message with the chosen index.
			const serialized: MenuItem[] = newItems.map(({ ariaLabel, disabled, divider, icon, isDelicate, label, title }) => ({
				ariaLabel,
				disabled,
				divider,
				icon,
				isDelicate,
				label,
				title,
			}));
			messagebox.sendMessage(new Message(MessageType.ContextMenuOpen, { items: serialized, x: clientX, y: clientY, targetId }));
		} else {
			isOpen.value = true;
			disableWheelScroll();
		}
	}

	function close() {
		isOpen.value = false;
		items.value = [];
		currentTargetId.value = null;

		enableWheelScroll();
	}

	function select(item: MenuItem) {
		if (item.disabled) return;

		try {
			item.onClick?.();
		} catch (err) {
			logger.error(err);
		}

		document.dispatchEvent(
			new CustomEvent('context-menu-select', {
				detail: { item, payload: item.onClick },
			}),
		);

		close();
	}

	// Called by the ContextMenuSelect message handler with the index chosen in the global-client.
	function selectByIndex(index: number) {
		const item = items.value[index];
		if (item) select(item);
	}

	return {
		close,
		currentTargetId,
		isOpen,
		items,
		open,
		select,
		selectByIndex,
		x,
		y,
	};
});
