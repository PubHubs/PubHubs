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
			<ContextMenuItem
				v-for="item in store.items"
				:aria-label="item.ariaLabel"
				:disabled="item.disabled"
				:icon="item.icon"
				:is-delicate="item.isDelicate"
				:label="item.label"
				:title="item.title"
				@click="store.select(item)"
				@mousedown.stop
			/>
		</div>

		<!-- Mobile scrim -->
		<Transition name="backdrop">
			<div v-if="store.isOpen && isMobile" class="fixed z-9998 bg-black/40" :style="{ ...visibleScreenBounds, top: '0px', bottom: '0px' }" @pointerdown.prevent.stop="store.close" @click.prevent.stop />
		</Transition>

		<!-- Mobile drawer menu -->
		<Transition name="drawer">
			<div
				v-if="store.isOpen && isMobile"
				ref="menuRef"
				class="bg-surface-elevated rounded-t-large pb-safe fixed bottom-0 z-9999 flex flex-col shadow-xl"
				:style="visibleScreenBounds"
				role="menu"
				data-testid="contextmenu"
				tabindex="-1"
				@keydown="onKeydown"
			>
				<!-- Drag handle -->
				<div class="flex justify-center py-150"></div>

				<ContextMenuItem
					v-for="item in store.items"
					:aria-label="item.ariaLabel"
					:disabled="item.disabled"
					:icon="item.icon"
					:is-delicate="item.isDelicate"
					:label="item.label"
					:title="item.title"
					@click="store.select(item)"
					@mousedown.stop
				/>

				<div class="h-300" />
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

	const visibleScreenBounds = computed(() => {
		const isInIframe = window.self !== window.top;

		if (!isInIframe || !isMobile.value) {
			return { left: '0px', width: '100%' };
		}

		const isOnFirstHalf = store.x < window.innerWidth / 2;

		return isOnFirstHalf ? { left: '0px', width: '50vw' } : { left: '50vw', width: '50vw' };
	});

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

<style scoped>
	.drawer-enter-active,
	.drawer-leave-active {
		transition: transform 300ms cubic-bezier(0.32, 0.72, 0, 1);
	}

	.drawer-enter-from,
	.drawer-leave-to {
		transform: translateY(100%);
	}

	.backdrop-enter-active,
	.backdrop-leave-active {
		transition: opacity 250ms ease;
	}

	.backdrop-enter-from,
	.backdrop-leave-to {
		opacity: 0;
	}
</style>
