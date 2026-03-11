// Packages
import { defineStore } from 'pinia';
import { ref } from 'vue';

// Models
import type { MenuItem } from '@hub-client/new-design/models/contextMenu.models';

let wheelHandler: ((e: Event) => void) | undefined;

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
		isOpen.value = true;
		currentTargetId.value = targetId;

		disableWheelScroll();
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
			console.error(err);
		}

		document.dispatchEvent(
			new CustomEvent('context-menu-select', {
				detail: { item, payload: item.onClick },
			}),
		);

		close();
	}

	return {
		close,
		currentTargetId,
		isOpen,
		items,
		open,
		select,
		x,
		y,
	};
});
