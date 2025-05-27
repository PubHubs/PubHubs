<template>
	<div class="flex h-full flex-1 flex-col justify-between gap-2 overflow-y-auto px-1 pt-3 md:gap-4 md:px-3" :class="{ 'rounded-md border-2 border-dashed border-accent-primary p-1': hubOrderingIsActive }">
		<draggable @start="onDragStart" @end="onDragEnd" :list="global.pinnedHubs" :item-key="'hubId'" handle=".handle" class="list-group flex flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden" group="hubs">
			<template #item="{ element }">
				<div
					v-if="hubs.hub(element.hubId)"
					class="hub-icon handle flex h-auto justify-center gap-1 p-2"
					@mousedown="longPressStart"
					@mouseup="longPressCancel"
					@touchstart="longPressStart"
					@touchend="longPressCancel"
					@contextmenu.prevent
				>
					<router-link :to="{ name: 'hub', params: { name: element.hubName } }" v-slot="{ isActive }" class="w-full" :style="{ pointerEvents: hubOrderingIsActive ? 'none' : 'auto' }">
						<HubMenuHubIcon
							class="text-on-surface"
							v-if="global.loggedIn || element.hubId === hubs.currentHubId"
							:hub="hubs.hub(element.hubId)"
							:hubId="element.hubId"
							:active="isActive"
							:pinned="true"
							:hubOrderingIsActive="hubOrderingIsActive"
							@click="sendToHub"
						/>
					</router-link>
				</div>
			</template>
		</draggable>
		<div class="relative h-12 max-h-0 overflow-hidden transition-all duration-300 ease-in-out" :class="{ 'max-h-12': hubOrderingIsActive }">
			<div class="absolute grid h-full w-full items-center justify-center">
				<Icon type="unpin" class="rounded-md p-1" :class="[hoverOverHubremoval ? 'text-accent-error opacity-100' : 'text-on-surface-disabled']" size="md" />
			</div>
			<draggable group="hubs" @dragover="hoverOverHubremoval = true" @dragleave="hoverOverHubremoval = false" :list="unpinnedHubs" @add="confirmationHubRemoval" :item-key="'unpin'" tag="ul" class="list-group h-full opacity-0">
				<template #item="{ element: trash }">
					<li>{{ trash }}</li>
				</template>
			</draggable>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Package imports
	import { ref } from 'vue';
	import draggable from 'vuedraggable';
	import { useI18n } from 'vue-i18n';

	// Global imports
	import HubMenuHubIcon from '@/components/ui/HubMenuHubIcon.vue';
	import { PinnedHubs, useDialog, useGlobal, useHubs, useMessageBox } from '@/logic/store/store';
	import { useToggleMenu } from '@/logic/store/toggleGlobalMenu';

	const global = useGlobal();
	const hubs = useHubs();
	const toggleMenu = useToggleMenu();
	const dialog = useDialog();
	const { t } = useI18n();
	const hoverOverHubremoval = ref(false);
	const hubOrderingIsActive = ref(false);

	let backupPinnedHubs = [] as PinnedHubs;
	let unpinnedHubs = [] as PinnedHubs;

	// Handle long press to start dragging
	const LONG_PRESS_DELAY = 300;
	let longPressTimer: ReturnType<typeof setTimeout> | null = null;

	// Long press start and cancel functions
	function longPressStart(e: MouseEvent | TouchEvent) {
		if (e.type === 'touchstart') {
			if (longPressTimer === null) {
				longPressTimer = setTimeout(() => {
					hubOrderingIsActive.value = true;
					longPressTimer = null;
				}, LONG_PRESS_DELAY);
			}
		} else {
			hubOrderingIsActive.value = true;
		}
	}

	function longPressCancel(e: MouseEvent | TouchEvent) {
		if (longPressTimer !== null) {
			clearTimeout(longPressTimer);
			longPressTimer = null;
		}
		if (e.type === 'touchend') {
			hubOrderingIsActive.value = false;
		}
	}

	// Handle dragging of the hub icons
	function onDragStart() {
		backupPinnedHubs = global.pinnedHubs.slice();
		hubOrderingIsActive.value = true;
	}

	function onDragEnd() {
		hoverOverHubremoval.value = false;
		setTimeout(() => {
			hubOrderingIsActive.value = false;
		}, 300);
	}

	// Handle the hub icon click
	function sendToHub() {
		if (!hubOrderingIsActive.value) {
			toggleMenu.hideMenuAndSendToHub();
		}
	}

	// Handle the confirmation of hub removal
	async function confirmationHubRemoval() {
		let removeHub = Boolean(await dialog.yesno(t('dialog.hub_unpin_title'), t('dialog.hub_unpin_context')));

		if (removeHub) {
			backupPinnedHubs.splice(0, backupPinnedHubs.length);
			const messagebox = useMessageBox();
			messagebox.resetMiniclient(unpinnedHubs[0].hubId);
		} else {
			global.pinnedHubs = backupPinnedHubs.slice();
			backupPinnedHubs.splice(0, backupPinnedHubs.length);
		}
		unpinnedHubs = [];
	}
</script>

<style scoped>
	.hub-icon {
		/* Disable context menu on iOS devices */
		-webkit-touch-callout: none; /* Prevents the context menu from showing */
		user-select: none;
		-webkit-user-select: none; /* Prevents text selection */
	}
</style>
