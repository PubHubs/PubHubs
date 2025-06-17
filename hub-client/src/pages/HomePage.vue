<template>
	<div class="h-[10svh] min-h-[90px] w-full">
		<HubBanner :banner-url="hubSettings.bannerUrl"></HubBanner>
	</div>
	<div class="m-auto flex h-full flex-col gap-8">
		<div class="mx-auto mt-20 flex w-8/12 flex-col items-center gap-4">
			<H1 v-if="!isTryOutHub() && hubSettings.hubName" class="text-center">{{ $t('home.hub_homepage_welcome_auth', [hubSettings.hubName]) }}</H1>
			<H1 v-else class="text-center">Welkom bij de TryOutHub</H1>
			<div class="mx-auto max-h-20 max-w-24 rounded-md">
				<HubIcon v-if="hubSettings.hubName" :hub-name="hubSettings.hubName" :icon-url="hubSettings.iconUrlLight" :icon-url-dark="hubSettings.iconUrlDark" />
			</div>
			<div v-if="isTryOutHub()" class="mt-20">
				<p class="mb-6">
					Hier kun je als organisatie een eigen Room krijgen om PubHubs zelf uit te proberen. Stel je organisatie heet ABC met webadres abc.nl. Dan kun je hier een eigen gesloten Room krijgen met naam ABC, binnen de TryOutHub.
					Alleen mensen die kunnen laten zien (via de Yivi app) dat ze een e-mailadres hebben van de vorm ...@abc.nl kunnen in deze Room ABC. Zo kunnen alleen eigen mensen van de room gebruik maken.
				</p>
				<p class="mb-6">
					Heb je interesse? Neem contact op via:
					<a style="all: revert" href="mailto:contact@pubhubs.net">contact@pubhubs.net</a>
				</p>
				<p class="mb-6">
					Het PubHubs team aan de Radboud Universiteit wil per Room een contactpersoon en aanspreekpunt (van organisatie ABC) die zichzelf bekend maakt (o.a. met mobiele nummer) en verantwoordelijkheid op zich neemt voor de inhoud
					en de toon van de gesprekken in de room ABC. Bij signalen van misbruik zal het PubHubs team de Room verwijderen.
				</p>
				<p class="mb-6">
					Binnen TryOutHub is er een Feedback Room waar iedereen in kan. Daar kunnen aanvullende vragen gesteld worden. Ook kunnen daar suggesties voor verbetering van PubHubs gegeven worden. Zulke feedback wordt gewaardeerd.
				</p>
				<p class="mb-6">
					De gegevens van de Room ABC zullen verwerkt worden op computers van de Radboud Universiteit. Gebruik de eigen experimentele Room dus niet voor vertrouwelijke informatie. Er worden geen garanties gegeven over de
					beschikbaarheid. Het gaat hier om een experimentele opzet, bedoeld om mensen en organisaties een beeld te geven van de stand van zaken en ontwikkeling van PubHubs. De Radboud Universiteit is hierbij op geen enkele manier
					aansprakelijk.
				</p>
				<p class="mb-6">
					Organisaties kunnen ook een stap verder gaan en een eigen Hub opzetten binnen PubHubs, met daarin meerdere Rooms. Dan vindt alle gegevensverwerking locaal plaats, op eigen systemen. Interesse? Neem dan ook contact op.
				</p>
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
			<Button v-if="!showPubHubsCentralLoginButton && !isTryOutHub()" class="md:~text-body-min/body-max mt-10 ~text-label-min/label-max" @click="goToLoginPage()">{{ $t('home.hub_homepage_join') }}</Button>
			<Button v-if="!showPubHubsCentralLoginButton && isTryOutHub()" class="md:~text-body-min/body-max mt-10 ~text-label-min/label-max" @click="goToLoginPage()">Doe mee met de TryOutHub </Button>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Logic
	import { ref, onBeforeMount } from 'vue';
	import { router } from '@/logic/core/router';
	import { usePubHubs } from '@/logic/core/pubhubsStore';
	import { useHubSettings } from '@/logic/store/hub-settings';
	// Components
	import H1 from '../components/elements/H1.vue';
	import HubIcon from '@/components/ui/HubIcon.vue';
	import HubBanner from '@/components/ui/HubBanner.vue';

	const pubhubs = usePubHubs();
	const hubSettings = useHubSettings();

	type Props = {
		/** This page can be shown to users that are not yet logged in to PubHubs Central. */
		showPubHubsCentralLoginButton: boolean;
	};

	const hubDescription = ref<string>(hubSettings.hubDescription);
	const hubContact = ref<string>(hubSettings.hubContact);

	const props = defineProps<Props>();

	onBeforeMount(async () => {
		loadHubSettings();
	});
	/**
	 * A hack to show a different homepage for the TryOutHub
	 * We ar still thinking about how to improve hub onboarding.
	 */
	function isTryOutHub(): boolean {
		return hubSettings.hubUrl === 'https://stable.tryouthub-matrix.pubhubs.net';
	}

	function goToLoginPage() {
		pubhubs.centralLoginPage();
	}

	function gotoDiscoverRooms() {
		router.push({ name: 'discover-rooms' });
	}
	async function loadHubSettings() {
		const hubSettingsJSON = await hubSettings.getHubJSON();
		hubDescription.value = hubSettingsJSON?.description ?? '';
		hubContact.value = hubSettingsJSON?.contact ?? '';
	}
</script>
<style scoped>
	.v-note-wrapper {
		position: relative;
	}
</style>
