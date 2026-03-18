<template>
	<div class="flex h-full flex-1 flex-col items-center justify-between gap-2 overflow-y-auto md:gap-4">
		<InlineSpinner v-if="global.loggedIn && global.hubsLoading" />
		<draggable
			@start="onDragStart"
			@end="onDragEnd"
			:list="global.pinnedHubs"
			:item-key="'hubId'"
			:delay="300"
			:delayOnTouchOnly="true"
			:touchStartThreshold="5"
			ghostClass="hub-drag-ghost"
			class="list-group flex w-full flex-1 flex-col gap-2 overflow-x-hidden p-4"
			group="hubs"
		>
			<template #item="{ element }">
				<div v-if="hubs.hub(element.hubId)" class="flex h-auto justify-center gap-4">
					<router-link :to="{ name: 'hub', params: { name: element.hubName } }" v-slot="{ isActive }" class="w-full">
						<HubMenuHubIcon class="text-on-surface" v-if="global.loggedIn || element.hubId === hubs.currentHubId" :hub="hubs.hub(element.hubId)" :hubId="element.hubId" :active="isActive" :pinned="true" @click="sendToHub" />
					</router-link>
				</div>
			</template>
		</draggable>
		<div class="relative h-12 max-h-0 w-full overflow-hidden transition-all duration-300 ease-in-out" :class="{ 'max-h-12': isDragging }">
			<div class="absolute grid h-full w-full items-center justify-center">
				<Icon type="trash" class="rounded-md p-1" :class="[hoverOverHubremoval ? 'text-on-accent-error' : 'text-accent-error']" size="lg" />
			</div>
			<draggable group="hubs" @dragover="hoverOverHubremoval = true" @dragleave="hoverOverHubremoval = false" :list="unpinnedHubs" @change="confirmationHubRemoval" :item-key="'unpin'" tag="ul" class="list-group h-full opacity-0">
				<template #item="{ element: trash }">
					<li>{{ trash }}</li>
				</template>
			</draggable>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { ref } from 'vue';
	import { useI18n } from 'vue-i18n';
	import draggable from 'vuedraggable';

	// Components
	import HubMenuHubIcon from '@global-client/components/ui/HubMenuHubIcon.vue';

	// Hub imports
	import InlineSpinner from '@hub-client/components/ui/InlineSpinner.vue';

	// Stores
	import { PinnedHubs, useGlobal } from '@global-client/stores/global';
	import { useHubs } from '@global-client/stores/hubs';
	import { useToggleMenu } from '@global-client/stores/toggleGlobalMenu';

	import { useDialog } from '@hub-client/stores/dialog';
	import { useMessageBox } from '@hub-client/stores/messagebox';

	const global = useGlobal();
	const hubs = useHubs();
	const toggleMenu = useToggleMenu();
	const dialog = useDialog();
	const { t } = useI18n();
	const isDragging = ref(false);
	const hoverOverHubremoval = ref(false);

	let backupPinnedHubs = [] as PinnedHubs;
	let unpinnedHubs = [] as PinnedHubs;

	function onDragStart() {
		backupPinnedHubs = global.pinnedHubs.slice();
		isDragging.value = true;
	}

	function onDragEnd() {
		isDragging.value = false;
		hoverOverHubremoval.value = false;
	}

	function sendToHub() {
		toggleMenu.hideMenuAndSendToHub();
	}

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
