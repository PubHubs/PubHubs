<template>
	<div class="flex h-full flex-1 flex-col items-center justify-between gap-2 overflow-y-auto md:gap-4" :class="{ 'rounded-md border-2 border-dashed border-on-surface-disabled p-1': hubOrderingIsActive }">
		<InlineSpinner v-if="global.hubsLoading" />
		<draggable
			@start="backupPinnedHubs = global.pinnedHubs.slice()"
			@end="hoverOverHubremoval = false"
			:list="global.pinnedHubs"
			:item-key="'hubId'"
			handle=".handle"
			class="list-group flex flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden px-2 md:px-4"
			group="hubs"
		>
			<template #item="{ element }">
				<div v-if="hubs.hub(element.hubId)" class="flex h-auto justify-center gap-1 p-1" :class="{ handle: hubOrderingIsActive }">
					<router-link :to="{ name: 'hub', params: { name: element.hubName } }" v-slot="{ isActive }" class="w-full">
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
			<draggable group="hubs" @dragover="hoverOverHubremoval = true" @dragleave="hoverOverHubremoval = false" :list="unpinnedHubs" @change="confirmationHubRemoval" :item-key="'unpin'" tag="ul" class="list-group h-full opacity-0">
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

	// Hub imports
	import InlineSpinner from '@/../../hub-client/src/components/ui/InlineSpinner.vue';

	const global = useGlobal();
	const hubs = useHubs();
	const toggleMenu = useToggleMenu();
	const dialog = useDialog();
	const { t } = useI18n();
	const hoverOverHubremoval = ref(false);

	let backupPinnedHubs = [] as PinnedHubs;
	let unpinnedHubs = [] as PinnedHubs;

	const props = defineProps({
		hubOrderingIsActive: Boolean,
	});

	function sendToHub(event: Event) {
		if (props.hubOrderingIsActive) {
			event.preventDefault();
		} else {
			toggleMenu.hideMenuAndSendToHub();
		}
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
