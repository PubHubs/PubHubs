<template>
	<div class="flex h-full flex-col gap-2">
		<div class="scrollbar grid flex-1 gap-2 overflow-y-auto pt-4">
			<draggable @start="backupPinnedHubs = global.pinnedHubs.slice()" @end="hoverOverHubremoval = false" :list="global.pinnedHubs" :item-key="'hubId'" handle=".handle" class="list-group flex flex-col gap-2" group="hubs">
				<template #item="{ element }">
					<div v-if="hubs.hub(element.hubId)" class="flex justify-center gap-1" :class="{ handle: hubOrderingIsActive }">
						<!-- When hub ordering is active, these buttons will be visible as an indicator -->
						<div class="my-auto flex flex-col gap-2 hover:cursor-pointer" :class="{ hidden: !hubOrderingIsActive }">
							<Icon type="triangle" size="xs"></Icon>
							<Icon class="rotate-180" type="triangle" size="xs"></Icon>
						</div>
						<router-link :to="{ name: 'hub', params: { name: element.hubName } }" v-slot="{ isActive }">
							<HubMenuHubIcon
								class="text-ph-text"
								v-if="global.loggedIn || element.hubId === hubs.currentHubId"
								:hub="hubs.hub(element.hubId)"
								:hubId="element.hubId"
								:active="isActive"
								:pinned="true"
								:hubOrderingIsActive="hubOrderingIsActive"
								@click="sendToHub"
							></HubMenuHubIcon>
						</router-link>
					</div>
				</template>
			</draggable>
		</div>
		<div class="relative h-14 max-h-0 overflow-hidden transition-all duration-300 ease-in-out" :class="{ 'max-h-14': hubOrderingIsActive }">
			<div class="absolute grid h-full w-full items-center justify-center">
				<Icon type="unpin" size="xl" :class="[hoverOverHubremoval ? 'text-red' : 'text-ph-accent-icon']"></Icon>
			</div>
			<draggable group="hubs" @dragover="hoverOverHubremoval = true" @dragleave="hoverOverHubremoval = false" :list="[]" @change="confirmationHubRemoval" :item-key="'unpin'" tag="ul" class="list-group h-full opacity-0">
				<template #item="{ element: trash }">
					<li>{{ trash }}</li>
				</template>
			</draggable>
		</div>
	</div>
</template>

<script setup lang="ts">
	import draggable from 'vuedraggable';
	import { PinnedHubs, useDialog, useGlobal, useHubs } from '@/logic/store/store';
	import { useToggleMenu } from '@/logic/store/toggleGlobalMenu';
	import { ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import HubMenuHubIcon from './HubMenuHubIcon.vue';

	const global = useGlobal();
	const hubs = useHubs();
	const toggleMenu = useToggleMenu();
	const dialog = useDialog();
	const { t } = useI18n();
	const hoverOverHubremoval = ref(false);

	let backupPinnedHubs = [] as PinnedHubs;

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
		} else {
			global.pinnedHubs = backupPinnedHubs.slice();
			backupPinnedHubs.splice(0, backupPinnedHubs.length);
		}
	}
</script>
