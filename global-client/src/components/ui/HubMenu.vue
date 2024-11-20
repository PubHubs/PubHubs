<template>
	<div class="flex flex-col justify-between gap-2 min-h-full">
		<div class="grid gap-2 p-2 pt-4">
			<draggable @start="backupPinnedHubs = global.pinnedHubs.slice()" @end="hoverOverHubremoval = false" :list="global.pinnedHubs" :item-key="'hubId'" handle=".handle" class="grid gap-2 list-group" group="hubs">
				<template #item="{ element }">
					<div class="flex gap-2 justify-center handle">
						<!-- Draggable button indicators when needed -->
						<div class="hover:cursor-pointer flex flex-col gap-2 my-auto" :class="{ hidden: !hubOrderingIsActive }">
							<Icon type="triangle" size="xs"></Icon>
							<Icon class="rotate-180" type="triangle" size="xs"></Icon>
						</div>
						<router-link class="bg-[#765090]" :to="{ name: 'hub', params: { id: element.hubId } }" v-slot="{ isActive }">
							<HubIcon
								class="text-ph-text border"
								v-if="global.loggedIn || element.hubId === hubs.currentHubId"
								:hub="hubs.hub(element.hubId)"
								:active="isActive"
								:pinned="true"
								:hubOrderingIsActive="hubOrderingIsActive"
								@click="sendToHub"
							></HubIcon>
						</router-link>
					</div>
				</template>
			</draggable>
		</div>
		<div class="relative h-14 max-h-0 overflow-hidden transition-all ease-in-out duration-300" :class="{ 'max-h-14': hubOrderingIsActive }">
			<div class="absolute grid justify-center items-center h-full w-full">
				<Icon type="unpin" size="xl" :class="[hoverOverHubremoval ? 'text-red' : 'text-ph-accent-icon']"></Icon>
			</div>
			<draggable group="hubs" @dragover="hoverOverHubremoval = true" @dragleave="hoverOverHubremoval = false" :list="[]" @change="confirmationHubRemoval" tag="ul" class="list-group h-full opacity-0">
				<template #item="{ element: trash }">
					<li>{{ trash }}</li>
				</template>
			</draggable>
		</div>
	</div>
</template>

<script setup lang="ts">
	import draggable from 'vuedraggable';
	import { PinnedHubs, useDialog, useGlobal, useHubs } from '@/store/store';
	import { useToggleMenu } from '@/store/toggleGlobalMenu';
	import { ref } from 'vue';
	import { useI18n } from 'vue-i18n';

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
