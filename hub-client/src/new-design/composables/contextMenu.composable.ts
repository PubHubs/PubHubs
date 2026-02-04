// New design
import { useContextMenuStore } from '@hub-client/new-design/stores/contextMenu.store';
import type { MenuItem } from '@hub-client/new-design/stores/contextMenu.store';

export function useContextMenu() {
	const LONG_PRESS_DURATION = 500;

	const store = useContextMenuStore();
	let longPressTimer: ReturnType<typeof setTimeout> | null = null;

	/**
	 * Opens the context menu
	 *
	 * @param evt - The triggering event
	 * @param items - The context menu item array
	 * @param targetId - The unique id for the context menu
	 */
	const openMenu = (evt: MouseEvent | PointerEvent | TouchEvent, items: MenuItem[], targetId: string | number | null = null): void => {
		const isTouch = 'touches' in evt;

		evt.preventDefault();
		evt.stopPropagation();

		// If it's a touch, start long press timer
		if (isTouch) {
			longPressTimer = setTimeout(() => {
				_openMenuAtEvent(evt, items, targetId);
			}, LONG_PRESS_DURATION);

			// Cancel long press if touch ends or moves
			const clearTimer = () => {
				if (longPressTimer) clearTimeout(longPressTimer);
				longPressTimer = null;
				window.removeEventListener('touchend', clearTimer);
				window.removeEventListener('touchmove', clearTimer);
			};

			window.addEventListener('touchend', clearTimer);
			window.addEventListener('touchmove', clearTimer);

			return;
		} else {
			_openMenuAtEvent(evt, items, targetId);
		}
	};

	/**
	 * Internal helper to compute coordinates and open the store
	 *
	 * @param evt - The triggering event
	 * @param items - The context menu item array
	 * @param targetId - The unique id for the context menu
	 */
	const _openMenuAtEvent = (evt: MouseEvent | PointerEvent | TouchEvent, items: MenuItem[], targetId: string | number | null = null): void => {
		const isTouch = 'touches' in evt;

		let x = 0;
		let y = 0;

		if (isTouch && evt.touches.length > 0) {
			x = evt.touches[0].clientX;
			y = evt.touches[0].clientY;
		} else if ('clientX' in evt) {
			x = evt.clientX;
			y = evt.clientY;
		}

		store.open(items, Math.round(x), Math.round(y), targetId);
	};

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
