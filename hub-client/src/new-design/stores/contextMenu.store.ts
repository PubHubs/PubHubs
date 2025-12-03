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

export const useContextMenuStore = defineStore('contextMenu', () => {
	// State
	const isOpen = ref(false);
	const x = ref(0);
	const y = ref(0);
	const items = ref<MenuItem[]>([]);

	// Computed
	const position = computed(() => ({ x: x.value, y: y.value }));

	// Functions
	function open(newItems: MenuItem[], clientX = 0, clientY = 0) {
		if (!newItems || newItems.length === 0) return;

		items.value = newItems;
		x.value = clientX;
		y.value = clientY;
		isOpen.value = true;
	}

	function close() {
		isOpen.value = false;
		items.value = [];
	}

	function select(item: MenuItem) {
		if (item.disabled) return;

		try {
			item.onClick?.();
		} catch (err) {
			console.error(err);
		}

		const ev = new CustomEvent('context-menu-select', {
			detail: { item, payload: item.onClick },
		});

		document.dispatchEvent(ev);

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
