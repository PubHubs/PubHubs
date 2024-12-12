<template>
	<div class="flex flex-col h-full xl:max-w-screen-xl m-auto p-5 gap-8">
		<div class="flex flex-col w-6/12 mt-20 mx-auto">
			<H1 v-if="!isTryOutHub()" class="text-center mb-8">{{ $t('home.hub_homepage_welcome_auth', [settings.hub.name]) }}</H1>
			<H1 v-else class="text-center mb-8">Welkom bij de TryOutHub</H1>
			<Logo class="mx-auto max-w-24 max-h-20"></Logo>
			<div v-if="isTryOutHub()" class="mt-20">
				<p class="mb-6">
					Hier kun je als organisatie een eigen Room krijgen om PubHubs zelf uit te proberen. Stel je organisatie heet ABC met webadres abc.nl. Dan kun je hier een eigen gesloten Room krijgen met naam ABC, binnen de TryOutHub.
					Alleen mensen die kunnen laten zien (via de Yivi app) dat ze een e-mailadres hebben van de vorm ...@abc.nl kunnen in deze Room ABC. Zo kunnen alleen eigen mensen van de room gebruik maken.
				</p>
				<p class="mb-6">Heb je interesse? Neem contact op via: <a style="all: revert" href="mailto:contact@pubhubs.net">contact@pubhubs.net</a></p>
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

			<Button v-if="!showPubHubsCentralLoginButton && !isTryOutHub()" class="mt-10 text-xs md:text-base" @click="goToLoginPage()">{{ $t('home.hub_homepage_join') }}</Button>
			<Button v-if="!showPubHubsCentralLoginButton && isTryOutHub()" class="mt-10 text-xs md:text-base" @click="goToLoginPage()">Doe mee met de TryOutHub </Button>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { usePubHubs } from '@/core/pubhubsStore';
	import { useHubSettings } from '@/store/hub-settings';
	import { useSettings } from '@/store/settings';

	// Components
	import H1 from '../components/elements/H1.vue';
	import Logo from '../components/ui/Logo.vue';

	const pubhubs = usePubHubs();
	const hubSettings = useHubSettings();
	const settings = useSettings();

	type Props = {
		/** This page can be shown to users that are not yet logged in to PubHubs Central. */
		showPubHubsCentralLoginButton: boolean;
	};

	const props = defineProps<Props>();

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
</script>
