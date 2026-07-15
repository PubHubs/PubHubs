<template>
	<div
		v-if="hub"
		class="bg-surface-base border-surface-elevated rounded-base relative flex w-full max-w-full flex-col overflow-hidden border-3"
	>
		<button
			type="button"
			class="focus-visible:ring-accent-blue-interactive absolute inset-0 z-10 cursor-pointer rounded-none outline-none focus-visible:ring-3 focus-visible:ring-inset"
			:aria-label="t('home.enter_hub', { hub: hub.hubName })"
			@click="enterHub(hub)"
		/>
		<!-- The banner takes whatever height the card has left over: cards in a grid row stretch to the
		     tallest of them, and that spare height is better spent on the image than left empty. -->
		<div
			class="bg-surface-base w-full flex-1"
			:class="isMobile ? 'min-h-1000' : 'min-h-1500'"
		>
			<HubBanner
				:banner-url="hub.bannerUrl"
				:hub-name-for-img-alt="hub.hubName"
				class="h-full! w-full"
			/>
		</div>
		<div class="flex h-1400 shrink-0 items-start gap-200 p-250 sm:p-300">
			<div class="bg-surface-base aspect-square h-600 w-600 shrink-0 overflow-clip rounded-xl">
				<HubIcon
					:hub-name="hub.name"
					:icon-url="hub.iconUrlLight"
					:icon-url-dark="hub.iconUrlDark"
				/>
			</div>
			<div class="gap-050 flex min-w-0 flex-col pr-200">
				<h2 class="truncate font-bold">
					{{ hub.hubName }}
				</h2>
				<p class="text-label text-on-surface-dim line-clamp-2">
					{{ summary }}
				</p>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { computed, onBeforeMount, ref } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { useRouter } from 'vue-router';

	// Components
	import HubBanner from '@hub-client/components/ui/HubBanner.vue';
	import HubIcon from '@hub-client/components/ui/HubIcon.vue';

	// Models
	import { type Hub } from '@global-client/models/Hubs';

	import { useGlobal } from '@global-client/stores/global';
	import { useMSS } from '@global-client/stores/mss';

	// Stores
	import { useDialog } from '@hub-client/stores/dialog';
	import { useSettings } from '@hub-client/stores/settings';

	const props = defineProps<{ hub: Hub }>();
	const router = useRouter();
	const dialog = useDialog();
	const { t } = useI18n();
	const _mss = useMSS();
	const _global = useGlobal();
	const settings = useSettings();

	const isMobile = computed(() => settings.isMobileState);

	const summary = ref<string>('');

	async function enterHub(hub: Hub) {
		let canEnterHub = false;
		try {
			// entering only the hub would generate a CORS-error.
			// Since we only need to know if the hub is running, we can send a no-cors.
			// The response will be empty, but the type 'opaque' will indicate the url is up and running
			const response = await fetch(hub.url, { mode: 'no-cors' });
			if (response.type === 'opaque') {
				canEnterHub = true;
			}
		} catch {
			// intentionally left empty
		}
		if (canEnterHub) {
			router.push({ name: 'hub', params: { name: hub.name } });
		} else {
			await dialog.confirm(hub.name, t('hubs.under_construction'), 'global');
		}
	}

	onBeforeMount(() => {
		loadHubSettings(props.hub);
	});
	async function loadHubSettings(hub: Hub): Promise<void> {
		const hubSettingsJSON = await hub.getHubJSON();
		if (hubSettingsJSON) {
			summary.value = hubSettingsJSON.summary ? hubSettingsJSON.summary : props.hub.description;
		} else {
			summary.value = props.hub.description;
		}
	}
</script>
