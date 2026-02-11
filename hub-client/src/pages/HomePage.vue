<template>
	<HeaderFooter>
		<template #header>
			<div class="flex h-full items-center" :class="isMobile ? 'pl-4' : 'pl-0'">
				<div class="flex w-fit items-center gap-3 overflow-hidden">
					<Icon type="house" />
					<H3 class="font-headings text-h3 text-on-surface font-semibold">{{ $t('menu.home') }}</H3>
				</div>
			</div>
		</template>

		<div class="mx-auto my-16 flex w-full flex-col gap-4 px-8 md:w-4/6 md:px-0">
			<div class="mx-auto mt-20 flex w-8/12 flex-col items-center gap-4">
				<H1 v-if="hubSettings.hubName" class="text-center">{{ $t('home.hub_homepage_welcome_auth', [hubSettings.hubName]) }}</H1>
				<div class="mx-auto my-10 max-h-20 w-fit max-w-24 rounded-md">
					<HubIcon class="h-auto w-fit" v-if="hubSettings.hubName" :hub-name="hubSettings.hubName" :icon-url="hubSettings.iconUrlLight" :icon-url-dark="hubSettings.iconUrlDark" />
				</div>
				<Button @click="gotoDiscoverRooms()" class="flex w-max justify-center gap-2"
					><Icon type="compass" size="lg" /><span>{{ $t('menu.discover') }}</span></Button
				>
				<H3 v-if="hubDescription" class="p-4">{{ $t('home.heading') }}</H3>
				<div v-if="hubDescription" class="bg-surface-low max-w-full rounded-2xl">
					<mavon-editor defaultOpen="preview" :toolbarsFlag="false" :subfield="false" v-model="hubDescription" :boxShadow="false" />
				</div>
				<H3 v-if="hubContact" class="p-4">{{ $t('home.contact_details') }}</H3>
				<div v-if="hubContact" class="bg-surface-low! max-w-full rounded-2xl">
					<mavon-editor defaultOpen="preview" :toolbarsFlag="false" :subfield="false" v-model="hubContact" :boxShadow="false" />
				</div>
			</div>
		</div>
	</HeaderFooter>
</template>

<script setup lang="ts">
	// Packages
	import { computed, onBeforeMount, ref } from 'vue';

	// Components
	import H1 from '@hub-client/components/elements/H1.vue';
	import HeaderFooter from '@hub-client/components/ui/HeaderFooter.vue';
	import HubIcon from '@hub-client/components/ui/HubIcon.vue';

	// Logic
	import { router } from '@hub-client/logic/core/router';

	// Stores
	import { useHubSettings } from '@hub-client/stores/hub-settings';
	import { useSettings } from '@hub-client/stores/settings';

	const hubSettings = useHubSettings();
	const settings = useSettings();

	const hubDescription = ref<string>(hubSettings.hubDescription);
	const hubContact = ref<string>(hubSettings.hubContact);

	const isMobile = computed(() => settings.isMobileState);

	onBeforeMount(async () => {
		loadHubSettings();
	});

	function gotoDiscoverRooms() {
		router.push({ name: 'discover-rooms' });
	}

	async function loadHubSettings() {
		const hubSettingsJSON = await hubSettings.getHubJSON();
		hubDescription.value = hubSettingsJSON?.description ?? '';
		hubContact.value = hubSettingsJSON?.contact ?? '';
	}
</script>
