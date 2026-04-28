<template>
	<HeaderFooter>
		<template #header>
			<div
				class="flex h-full items-center"
				:class="isMobile ? 'pl-4' : 'pl-0'"
			>
				<div class="flex w-fit items-center gap-3 overflow-hidden">
					<Icon type="house" />
					<H3 class="font-headings text-h3 text-on-surface font-semibold">
						{{ $t('menu.home') }}
					</H3>
				</div>
			</div>
		</template>

		<div class="mx-auto my-16 flex w-full flex-col gap-4 px-8 md:w-4/6 md:px-0">
			<div class="mt-20 flex flex-col items-center gap-4">
				<H1
					v-if="hubSettings.hubName"
					class="text-center"
				>
					{{ $t('home.hub_homepage_welcome_auth', [hubSettings.hubName]) }}
				</H1>
				<div class="mx-auto my-10 max-h-20 w-fit max-w-24 rounded-md">
					<HubIcon
						v-if="hubSettings.hubName"
						class="h-auto w-fit"
						:hub-name="hubSettings.hubName"
						:icon-url="hubSettings.iconUrlLight"
						:icon-url-dark="hubSettings.iconUrlDark"
					/>
				</div>
				<Button
					class="flex w-max justify-center gap-2"
					@click="gotoDiscoverRooms()"
				>
					<Icon
						size="lg"
						type="compass"
					/><span>{{ $t('menu.discover') }}</span>
				</Button>
				<H3
					v-if="hubDescription"
					class="p-4"
				>
					{{ $t('home.heading') }}
				</H3>
				<div
					v-if="hubDescription"
					class="bg-surface-low max-w-full rounded-2xl"
				>
					<mavon-editor
						v-model="hubDescription"
						:box-shadow="false"
						default-open="preview"
						:subfield="false"
						:toolbars-flag="false"
					/>
				</div>
				<H3
					v-if="hubContact"
					class="p-4"
				>
					{{ $t('home.contact_details') }}
				</H3>
				<div
					v-if="hubContact"
					class="bg-surface-low! max-w-full rounded-2xl"
				>
					<mavon-editor
						v-model="hubContact"
						:box-shadow="false"
						default-open="preview"
						:subfield="false"
						:toolbars-flag="false"
					/>
				</div>
			</div>
		</div>
	</HeaderFooter>
</template>

<script lang="ts" setup>
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
