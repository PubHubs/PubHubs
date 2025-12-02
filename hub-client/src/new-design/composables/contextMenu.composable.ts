// New design
import { useContextMenuStore } from '@hub-client/new-design/stores/contextMenu.store';
import type { MenuItem } from '@hub-client/new-design/stores/contextMenu.store';

export function useContextMenu(items: MenuItem[]) {
	const store = useContextMenuStore();

	function openMenu(evt: MouseEvent | PointerEvent) {
		evt.preventDefault();
		evt.stopPropagation();

		const x = (evt as MouseEvent).clientX ?? 0;
		const y = (evt as MouseEvent).clientY ?? 0;

		store.open(items, Math.round(x), Math.round(y));
	}

	function close() {
		store.close();
	}

	function select(item: MenuItem) {
		store.select(item);
	}

	return {
		openMenu,
		close,
		select,
	};
}
