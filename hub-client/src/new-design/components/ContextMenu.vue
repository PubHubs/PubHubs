<template>
	<teleport to="body">
		<!-- Backdrop -->
		<div v-if="store.isOpen" class="fixed inset-0 z-9998 bg-transparent" @pointerdown.prevent.stop="store.close" @click.prevent.stop />

		<!-- Context menu -->
		<div
			v-if="store.isOpen"
			ref="menuRef"
			class="bg-surface-elevated rounded-base fixed z-9999 flex w-fit max-w-4000 min-w-1000 flex-col shadow-xl"
			:style="{ left: `${pos.x}px`, top: `${pos.y}px` }"
			role="menu"
			tabindex="-1"
			@keydown="onKeydown"
		>
			<ContextMenuItem
				v-for="item in store.items"
				:aria-label="item.ariaLabel"
				:disabled="item.disabled"
				:icon="item.icon"
				:is-delicate="item.isDelicate"
				:label="item.label"
				:title="item.title"
				@click="onItemClick(item)"
				@mousedown.stop
			/>
		</div>
	</teleport>
</template>

<script setup lang="ts">
	// Packages
	import { nextTick, onUnmounted, ref, watch } from 'vue';

	// New design
	import ContextMenuItem from '@hub-client/new-design/components/ContextMenuItem.vue';
	import { useContextMenuStore } from '@hub-client/new-design/stores/contextMenu.store';

	const POINTER_OFFSET = 8;
	const GLOBAL_BAR_WIDTH = 80;

	const store = useContextMenuStore();
	const menuRef = ref<HTMLElement | null>(null);
	const itemButtons = ref<HTMLButtonElement[]>([]);
	const pos = ref({ x: 0, y: 0 });

	/**
	 * Get visible boundaries for menu positioning.
	 * Handles mobile scroll-snap layout where the iframe is wider than the visible screen.
	 *
	 * @param clickX - The x-coordinate of the click
	 */
	const getVisibleBounds = (clickX: number) => {
		const isInIframe = window.self !== window.top;
		const screenWidth = window.screen.availWidth || window.screen.width;
		const isMobileScrollSnap = isInIframe && window.innerWidth > screenWidth * 1.2;

		if (isMobileScrollSnap) {
			// Mobile scroll-snap: iframe is ~200vw wide, only one screen visible at a time
			// Screen 1 shows iframe [0, screenWidth - GLOBAL_BAR_WIDTH]
			// Screen 2 shows iframe [screenWidth - GLOBAL_BAR_WIDTH, end]
			const screen1RightEdge = screenWidth - GLOBAL_BAR_WIDTH;
			const isOnScreen1 = clickX < screen1RightEdge;

			if (isOnScreen1) {
				return { left: POINTER_OFFSET, right: screen1RightEdge - POINTER_OFFSET };
			}

			return {
				left: screen1RightEdge + POINTER_OFFSET,
				right: Math.min(screen1RightEdge + screenWidth, window.innerWidth) - POINTER_OFFSET,
			};
		}

		// Desktop or normal iframe: use actual viewport/iframe width
		const width = window.visualViewport?.width ?? window.innerWidth;
		return { left: POINTER_OFFSET, right: width - POINTER_OFFSET };
	};

	/**
	 * Clamp menu position to stay within visible bounds.
	 *
	 * @param x - The initial x position
	 * @param y - The initial y position
	 * @param clickX - The original click x-coordinate for bounds calculation
	 */
	const clampPosition = (x: number, y: number, clickX: number) => {
		if (!menuRef.value) return { x, y };

		const { width: menuWidth, height: menuHeight } = menuRef.value.getBoundingClientRect();
		const bounds = getVisibleBounds(clickX);
		const viewportHeight = window.visualViewport?.height ?? window.innerHeight;

		// Horizontal clamping
		let nx = x;
		if (x + menuWidth > bounds.right) {
			nx = Math.max(bounds.left, bounds.right - menuWidth);
		}
		if (nx < bounds.left) {
			nx = bounds.left;
		}

		// Vertical clamping
		let ny = y;
		if (y + menuHeight > viewportHeight - POINTER_OFFSET) {
			ny = Math.max(POINTER_OFFSET, viewportHeight - menuHeight - POINTER_OFFSET);
		}
		if (ny < POINTER_OFFSET) {
			ny = POINTER_OFFSET;
		}

		return { x: nx, y: ny };
	};

	/**
	 * Position the menu and set up keyboard navigation.
	 */
	const positionMenu = async () => {
		await nextTick();

		const rawX = store.x + POINTER_OFFSET;
		const rawY = store.y + POINTER_OFFSET;
		const { x, y } = clampPosition(rawX, rawY, store.x);
		pos.value = { x, y };

		// Collect menu item buttons for keyboard navigation
		if (menuRef.value) {
			itemButtons.value = Array.from(menuRef.value.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]'));
		}

		// Focus first enabled item
		itemButtons.value.find((b) => !b.disabled)?.focus();
	};

	/**
	 * Handle menu item click.
	 *
	 * @param item - The clicked menu item
	 */
	const onItemClick = (item: any) => {
		store.select(item);
	};

	/**
	 * Focus the next enabled button in the given direction.
	 *
	 * @param buttons - Array of menu item buttons
	 * @param currentIndex - Current focused button index
	 * @param direction - Direction to move (1 for forward, -1 for backward)
	 */
	const focusNextEnabled = (buttons: HTMLButtonElement[], currentIndex: number, direction: 1 | -1) => {
		const len = buttons.length;
		let index = currentIndex;

		do {
			index = (index + direction + len) % len;
		} while (buttons[index].disabled && index !== currentIndex);

		buttons[index]?.focus();
	};

	/**
	 * Handle keyboard navigation within the menu.
	 *
	 * @param e - The keyboard event
	 */
	const onKeydown = (e: KeyboardEvent) => {
		const buttons = itemButtons.value;
		if (!buttons.length) return;

		const currentIndex = buttons.findIndex((btn) => btn === document.activeElement);

		switch (e.key) {
			case 'Escape':
				e.preventDefault();
				store.close();
				break;

			case 'ArrowDown':
				e.preventDefault();
				focusNextEnabled(buttons, currentIndex, 1);
				break;

			case 'ArrowUp':
				e.preventDefault();
				focusNextEnabled(buttons, currentIndex, -1);
				break;

			case 'Enter':
			case ' ':
				e.preventDefault();
				(document.activeElement as HTMLButtonElement)?.click();
				break;

			case 'Tab':
				e.preventDefault();
				focusNextEnabled(buttons, currentIndex, e.shiftKey ? -1 : 1);
				break;
		}
	};

	watch(
		() => store.isOpen,
		async (open) => {
			if (open) {
				await nextTick();
				positionMenu();
				window.addEventListener('resize', positionMenu);
				window.addEventListener('scroll', positionMenu, true);
			} else {
				window.removeEventListener('resize', positionMenu);
				window.removeEventListener('scroll', positionMenu, true);
			}
		},
		{ immediate: true },
	);

	onUnmounted(() => {
		window.removeEventListener('resize', positionMenu);
		window.removeEventListener('scroll', positionMenu, true);
	});
</script>
