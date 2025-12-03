// Packages
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

// New design
import { ContextMenuItemProps } from '@hub-client/new-design/components/ContextMenuItem.vue';

// Types
export type MenuItem = ContextMenuItemProps & {
	onClick?: () => void;
	payload?: any;
};

let _wheelHandler: (e: Event) => void;

export const useContextMenuStore = defineStore('contextMenu', () => {
	// State
	const isOpen = ref(false);
	const x = ref(0);
	const y = ref(0);
	const items = ref<MenuItem[]>([]);

	// Computed
	const position = computed(() => ({ x: x.value, y: y.value }));

	// Functions
	function _disableWheelScroll() {
		_wheelHandler = (e: Event) => e.preventDefault();
		window.addEventListener('wheel', _wheelHandler, { passive: false, capture: true });
	}

	function _enableWheelScroll() {
		if (_wheelHandler) {
			window.removeEventListener('wheel', _wheelHandler, { capture: true });
			_wheelHandler = undefined as any;
		}
	}

	function open(newItems: MenuItem[], clientX = 0, clientY = 0) {
		if (!newItems || newItems.length === 0) return;

		items.value = newItems;
		x.value = clientX;
		y.value = clientY;
		isOpen.value = true;

		_disableWheelScroll();
	}

	function close() {
		isOpen.value = false;
		items.value = [];
		_enableWheelScroll();
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
		isOpen,
		items,
		open,
		position,
		select,
		x,
		y,
	};
});
