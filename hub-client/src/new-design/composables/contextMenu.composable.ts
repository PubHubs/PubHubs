// New design
import { useContextMenuStore } from '@hub-client/new-design/stores/contextMenu.store';
import type { MenuItem } from '@hub-client/new-design/stores/contextMenu.store';

export function useContextMenu() {
	const store = useContextMenuStore();

	function openMenu(evt: MouseEvent | PointerEvent | TouchEvent, items: MenuItem[], targetId: string | number | null = null) {
		evt.preventDefault();
		evt.stopPropagation();

		let x = 0;
		let y = 0;

		if ('touches' in evt && evt.touches.length > 0) {
			// TouchEvent
			x = evt.touches[0].clientX;
			y = evt.touches[0].clientY;
		} else if ('clientX' in evt) {
			// MouseEvent or PointerEvent
			x = evt.clientX;
			y = evt.clientY;
		}

		store.open(items, Math.round(x), Math.round(y), targetId);
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
