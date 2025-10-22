<template>
	<div class="h-[10svh] min-h-[90px] w-full">
		<HubBanner :banner-url="hubSettings.bannerUrl"></HubBanner>
	</div>
	<div class="m-auto flex h-full flex-col gap-8">
		<div class="mx-auto mt-20 flex w-8/12 flex-col items-center gap-4">
			<H1 v-if="hubSettings.hubName" class="text-center">{{ $t('home.hub_homepage_welcome_auth', [hubSettings.hubName]) }}</H1>
			<div class="mx-auto max-h-20 w-fit max-w-24 rounded-md">
				<HubIcon class="w-auto" v-if="hubSettings.hubName" :hub-name="hubSettings.hubName" :icon-url="hubSettings.iconUrlLight" :icon-url-dark="hubSettings.iconUrlDark" />
			</div>
			<Button @click="gotoDiscoverRooms()" class="flex w-max justify-center gap-2"
				><Icon type="pubhubs-home" /><span>{{ $t('menu.discover') }}</span></Button
			>
			<H3 v-if="hubDescription" class="p-4">{{ $t('home.heading') }}</H3>
			<div v-if="hubDescription" class="max-w-full rounded-2xl bg-surface-low">
				<mavon-editor defaultOpen="preview" :toolbarsFlag="false" :subfield="false" v-model="hubDescription" :boxShadow="false" />
			</div>
			<H3 v-if="hubContact" class="p-4">{{ $t('home.contact_details') }}</H3>
			<div v-if="hubContact" class="max-w-full rounded-2xl bg-surface-low">
				<mavon-editor defaultOpen="preview" :toolbarsFlag="false" :subfield="false" v-model="hubContact" :boxShadow="false" />
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Logic
	import { ref, onBeforeMount } from 'vue';
	import { router } from '@/logic/core/router';
	import { useHubSettings } from '@/logic/store/hub-settings';
	// Components
	import H1 from '../components/elements/H1.vue';
	import HubIcon from '@/components/ui/HubIcon.vue';
	import HubBanner from '@/components/ui/HubBanner.vue';
	import Icon from '@/components/elements/Icon.vue';
	import Button from '@/components/elements/Button.vue';
	import H3 from '@/components/elements/H3.vue';

	const hubSettings = useHubSettings();
	const hubDescription = ref<string>(hubSettings.hubDescription);
	const hubContact = ref<string>(hubSettings.hubContact);

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
