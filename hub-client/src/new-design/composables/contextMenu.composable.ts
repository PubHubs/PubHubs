// Models
import { SystemDefaults } from '@hub-client/models/constants';

// New design
import { type MenuItem, useContextMenuStore } from '@hub-client/new-design/stores/contextMenu.store';

export function useContextMenu() {
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

		if (isTouch) {
			longPressTimer = setTimeout(() => {
				openMenuAtEvent(evt, items, targetId);
			}, SystemDefaults.longPressDuration);

			const clearTimer = () => {
				if (longPressTimer) clearTimeout(longPressTimer);
				longPressTimer = null;
				window.removeEventListener('touchend', clearTimer);
				window.removeEventListener('touchmove', clearTimer);
			};

			window.addEventListener('touchend', clearTimer);
			window.addEventListener('touchmove', clearTimer);

			return;
		}

		openMenuAtEvent(evt, items, targetId);
	};

	/**
	 * Internal helper to compute coordinates and open the store
	 *
	 * @param evt - The triggering event
	 * @param items - The context menu item array
	 * @param targetId - The unique id for the context menu
	 */
	const openMenuAtEvent = (evt: MouseEvent | PointerEvent | TouchEvent, items: MenuItem[], targetId: string | number | null = null): void => {
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

	const close = () => {
		store.close();
	};

	const select = (item: MenuItem) => {
		store.select(item);
	};

	return {
		close,
		openMenu,
		select,
	};
}
