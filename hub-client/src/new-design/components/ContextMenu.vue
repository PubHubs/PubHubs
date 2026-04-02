<template>
	<teleport to="body">
		<!-- Desktop backdrop -->
		<div v-if="store.isOpen && !isMobile" class="fixed inset-0 z-9998 bg-transparent" @pointerdown.prevent.stop="store.close" @click.prevent.stop />

		<!-- Desktop menu -->
		<div
			v-if="store.isOpen && !isMobile"
			ref="menuRef"
			class="bg-surface-elevated rounded-base fixed z-9999 flex w-fit max-w-4000 min-w-1000 flex-col shadow-xl"
			:style="{ left: `${pos.x}px`, top: `${pos.y}px` }"
			role="menu"
			data-testid="contextmenu"
			tabindex="-1"
			@keydown="onKeydown"
		>
			<template v-for="(item, i) in store.items" :key="i">
				<div v-if="item.divider" class="bg-surface-low my-50 h-px shrink-0" />
				<ContextMenuItem v-else :aria-label="item.ariaLabel" :disabled="item.disabled" :icon="item.icon" :is-delicate="item.isDelicate" :label="item.label" :title="item.title" @click="store.select(item)" @mousedown.stop />
			</template>
		</div>

		<!-- Mobile scrim -->
		<Transition enter-active-class="transition-opacity duration-250 ease-in-out" leave-active-class="transition-opacity duration-250 ease-in-out" enter-from-class="opacity-0" leave-to-class="opacity-0">
			<div v-if="store.isOpen && isMobile" class="fixed inset-0 z-9998 bg-black/40" @pointerdown.prevent.stop="store.close" @click.prevent.stop />
		</Transition>

		<!-- Mobile drawer menu -->
		<Transition
			enter-active-class="transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
			leave-active-class="transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
			enter-from-class="translate-y-full"
			leave-to-class="translate-y-full"
		>
			<div
				v-if="store.isOpen && isMobile"
				ref="menuRef"
				class="bg-surface-elevated rounded-t-large pb-safe fixed bottom-0 left-0 z-9999 flex w-full flex-col shadow-xl"
				role="menu"
				data-testid="contextmenu"
				tabindex="-1"
				@keydown="onKeydown"
			>
				<!-- Drag handle -->
				<div class="flex justify-center py-200"></div>

				<template v-for="(item, i) in store.items" :key="i">
					<div v-if="item.divider" class="bg-surface-low my-100 h-px shrink-0" />
					<ContextMenuItem v-else :aria-label="item.ariaLabel" :disabled="item.disabled" :icon="item.icon" :is-delicate="item.isDelicate" :label="item.label" :title="item.title" @click="store.select(item)" @mousedown.stop />
				</template>

				<div class="h-200" />
			</div>
		</Transition>
	</teleport>
</template>

<script setup lang="ts">
	// Packages
	import { computed, nextTick, onUnmounted, ref, watch } from 'vue';

	// Stores
	import { useSettings } from '@hub-client/stores/settings';

	// New design
	import ContextMenuItem from '@hub-client/new-design/components/ContextMenuItem.vue';
	import { useContextMenuStore } from '@hub-client/new-design/stores/contextMenu.store';

	// Constants
	const POINTER_OFFSET = 8;

	// State
	const store = useContextMenuStore();
	const settings = useSettings();
	const isMobile = computed(() => settings.isMobileState);
	const menuRef = ref<HTMLElement | null>(null);
	const itemButtons = ref<HTMLButtonElement[]>([]);
	const pos = ref({ x: 0, y: 0 });

	// Positioning (desktop only)

	const clampPosition = (x: number, y: number) => {
		if (!menuRef.value) return { x, y };

		const { width: menuWidth, height: menuHeight } = menuRef.value.getBoundingClientRect();
		const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
		const viewportHeight = window.visualViewport?.height ?? window.innerHeight;

		let nx = x;
		if (x + menuWidth > viewportWidth - POINTER_OFFSET) {
			nx = Math.max(POINTER_OFFSET, viewportWidth - menuWidth - POINTER_OFFSET);
		}
		if (nx < POINTER_OFFSET) nx = POINTER_OFFSET;

		let ny = y;
		if (y + menuHeight > viewportHeight - POINTER_OFFSET) {
			ny = Math.max(POINTER_OFFSET, viewportHeight - menuHeight - POINTER_OFFSET);
		}
		if (ny < POINTER_OFFSET) ny = POINTER_OFFSET;

		return { x: nx, y: ny };
	};

	const positionMenu = async () => {
		await nextTick();
		const { x, y } = clampPosition(store.x + POINTER_OFFSET, store.y + POINTER_OFFSET);
		pos.value = { x, y };
		collectItemButtons();
		itemButtons.value.find((b) => !b.disabled)?.focus();
	};

	const collectItemButtons = () => {
		if (menuRef.value) {
			itemButtons.value = Array.from(menuRef.value.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]'));
		}
	};

	// Keyboard navigation

	const focusNextEnabled = (buttons: HTMLButtonElement[], currentIndex: number, direction: 1 | -1) => {
		const len = buttons.length;
		let index = currentIndex;
		do {
			index = (index + direction + len) % len;
		} while (buttons[index].disabled && index !== currentIndex);
		buttons[index]?.focus();
	};

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

	// Lifecycle

	watch(
		() => store.isOpen,
		async (open) => {
			if (open) {
				if (isMobile.value) {
					document.body.style.overflow = 'hidden';
					await nextTick();
					collectItemButtons();
					itemButtons.value.find((b) => !b.disabled)?.focus();
				} else {
					positionMenu();
					window.addEventListener('resize', positionMenu);
					window.addEventListener('scroll', positionMenu, true);
				}
			} else {
				document.body.style.overflow = '';
				window.removeEventListener('resize', positionMenu);
				window.removeEventListener('scroll', positionMenu, true);
			}
		},
		{ immediate: true },
	);

	onUnmounted(() => {
		document.body.style.overflow = '';
		window.removeEventListener('resize', positionMenu);
		window.removeEventListener('scroll', positionMenu, true);
	});
</script>
