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

	const store = useContextMenuStore();
	const menuRef = ref<HTMLElement | null>(null);
	const itemButtons = ref<HTMLButtonElement[]>([]);
	const pos = ref({ x: 0, y: 0 });

	// Positioning helper function
	function clampToViewport(x: number, y: number) {
		if (!menuRef.value) return { x, y };

		const rect = menuRef.value.getBoundingClientRect();
		const vw = window.innerWidth;
		const vh = window.innerHeight;

		let nx = x;
		let ny = y;

		// If menu overflows right edge, shift left
		if (x + rect.width > vw - POINTER_OFFSET) nx = Math.max(POINTER_OFFSET, vw - rect.width - POINTER_OFFSET);

		// If menu overflows bottom, shift up
		if (y + rect.height > vh - POINTER_OFFSET) ny = Math.max(POINTER_OFFSET, vh - rect.height - POINTER_OFFSET);

		// Ensure not negative
		nx = Math.max(POINTER_OFFSET, nx);
		ny = Math.max(POINTER_OFFSET, ny);

		return { x: nx, y: ny };
	}

	// Handle menu positioning and focus state
	async function positionMenu() {
		// Wait for DOM update
		await nextTick();

		// Apply pointer offset so the cursor doesn't overlap the menu
		const rawX = store.x + POINTER_OFFSET;
		const rawY = store.y + POINTER_OFFSET;
		const { x: nx, y: ny } = clampToViewport(rawX, rawY);

		pos.value = { x: nx, y: ny };

		// Refresh item refs
		if (menuRef.value) {
			const menuItems = Array.from(menuRef.value.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]'));
			itemButtons.value = menuItems;
		}

		// Focus the first enabled item for keyboard users
		const firstEnabled = itemButtons.value.find((b) => !b.disabled);
		firstEnabled?.focus();
	}

	function onItemClick(item: any) {
		store.select(item);
	}

	// Handle keyboard select
	function onKeydown(e: KeyboardEvent) {
		const buttons = itemButtons.value;

		if (!buttons.length) return;

		const currentIndex = buttons.findIndex((button) => button === document.activeElement);
		if (e.key === 'Escape') {
			e.preventDefault();
			store.close();
			return;
		}
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			let next = currentIndex + 1;
			while (next < buttons.length && buttons[next].disabled) next++;

			// Focus next enabled
			if (next >= buttons.length) next = 0;
			buttons[next]?.focus();
		}
		if (e.key === 'ArrowUp') {
			e.preventDefault();
			let prev = currentIndex - 1;
			while (prev >= 0 && buttons[prev].disabled) prev--;

			// Focus last enabled
			if (prev < 0) {
				prev = buttons.length - 1;
				while (prev >= 0 && buttons[prev].disabled) prev--;
			}
			if (prev >= 0) buttons[prev]?.focus();
		}
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			const btn = document.activeElement as HTMLButtonElement | null;
			if (btn) btn.click();
		}
		if (e.key === 'Tab') {
			e.preventDefault();
			let nextIndex = currentIndex;

			if (e.shiftKey) {
				// Move backward
				do {
					nextIndex = (nextIndex - 1 + buttons.length) % buttons.length;
				} while (buttons[nextIndex].disabled && nextIndex !== currentIndex);
			} else {
				// Move forward
				do {
					nextIndex = (nextIndex + 1) % buttons.length;
				} while (buttons[nextIndex].disabled && nextIndex !== currentIndex);
			}

			buttons[nextIndex]?.focus();
		}
	}

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

	// Clean up on unmount
	onUnmounted(() => {
		window.removeEventListener('resize', positionMenu);
		window.removeEventListener('scroll', positionMenu, true);
	});
</script>
