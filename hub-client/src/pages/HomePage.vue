<template>
	<HeaderFooter>
		<template #header>
			<div
				class="flex h-full items-center"
				:class="isMobile ? 'pl-200' : 'pl-0'"
			>
				<div class="flex w-fit items-center gap-150 overflow-hidden">
					<Icon type="house" />
					<H3 class="font-headings text-h3 text-on-surface font-semibold">
						{{ $t('menu.home') }}
					</H3>
				</div>
			</div>
		</template>

		<div class="mx-auto my-800 flex w-full flex-col gap-200 px-40000 md:w-4/6 md:px-0">
			<div class="mt-800 flex flex-col items-center gap-200">
				<H1
					v-if="hubSettings.hubName"
					class="text-center"
				>
					{{ $t('home.hub_homepage_welcome_auth', [hubSettings.hubName]) }}
				</H1>
				<div class="mx-auto my-500 max-h-800 w-fit max-w-1000 rounded-md">
					<HubIcon
						v-if="hubSettings.hubName"
						class="h-auto w-fit"
						:hub-name="hubSettings.hubName"
						:icon-url="hubSettings.iconUrlLight"
						:icon-url-dark="hubSettings.iconUrlDark"
					/>
				</div>
				<Button
					icon="compass"
					class="flex w-max justify-center gap-100"
					@click="gotoDiscoverRooms()"
				>
					{{ $t('menu.discover') }}
				</Button>
				<H3
					v-if="hubDescription"
					class="p-200"
				>
					{{ $t('home.heading') }}
				</H3>
				<MarkdownPreview
					v-if="hubDescription"
					:content="hubDescription"
					class="bg-surface-base w-full rounded-2xl px-200 py-200"
				/>
				<H3
					v-if="hubContact"
					class="p-200"
				>
					{{ $t('home.contact_details') }}
				</H3>
				<MarkdownPreview
					v-if="hubContact"
					:content="hubContact"
					class="bg-surface-base! w-full rounded-2xl px-200 py-200"
				/>
			</div>
		</div>
	</HeaderFooter>
</template>

<script lang="ts" setup>
	// Packages
	import { computed, onBeforeMount, ref } from 'vue';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import H1 from '@hub-client/components/elements/H1.vue';
	import H3 from '@hub-client/components/elements/H3.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import MarkdownPreview from '@hub-client/components/forms/elements/MarkdownPreview.vue';
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
