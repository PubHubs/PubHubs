<template>
	<div
		v-if="hub"
		class="bg-surface-base border-surface-elevated rounded-base relative flex w-full max-w-full flex-col overflow-hidden border-3 hover:cursor-pointer"
		@click="enterHub(hub)"
	>
		<span
			v-if="contact"
			class="bg-on-surface-bright text-surface-base absolute top-100 right-100 z-50 flex cursor-pointer items-center justify-center rounded-full p-[1px]"
			:title="copied ? t('home.contact_copied') : contact"
			@click.stop="copyContact"
		>
			<Icon :type="copied ? 'check' : 'info'" />
		</span>
		<div class="bg-surface-base h-1200 w-full shrink-0">
			<HubBanner
				:banner-url="hub.bannerUrl"
				:hub-name="hub.name"
				class="h-full! w-full"
			/>
		</div>
		<div class="flex h-2000 items-start gap-200 p-250 sm:p-300">
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
	import { onBeforeMount, ref } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { useRouter } from 'vue-router';

	import Icon from '@hub-client/components/elements/Icon.vue';
	// Components
	import HubBanner from '@hub-client/components/ui/HubBanner.vue';
	import HubIcon from '@hub-client/components/ui/HubIcon.vue';

	// Models
	import { type Hub } from '@global-client/models/Hubs';

	import { useGlobal } from '@global-client/stores/global';
	import { useMSS } from '@global-client/stores/mss';

	// Stores
	import { useDialog } from '@hub-client/stores/dialog';

	const props = defineProps<{ hub: Hub }>();
	const router = useRouter();
	const dialog = useDialog();
	const { t } = useI18n();
	const _mss = useMSS();
	const _global = useGlobal();

	const summary = ref<string>('');
	const contact = ref<string>('');
	const copied = ref(false);

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
			await dialog.confirm(hub.name, t('hubs.under_construction'));
		}
	}

	async function copyContact() {
		try {
			await navigator.clipboard.writeText(contact.value);
			copied.value = true;
			setTimeout(() => (copied.value = false), 1500);
		} catch {
			// intentionally left empty
		}
	}

	onBeforeMount(() => {
		loadHubSettings(props.hub);
	});
	async function loadHubSettings(hub: Hub): Promise<void> {
		const hubSettingsJSON = await hub.getHubJSON();
		if (hubSettingsJSON) {
			summary.value = hubSettingsJSON.summary ? hubSettingsJSON.summary : props.hub.description;
			contact.value = hubSettingsJSON.contact;
		} else {
			summary.value = props.hub.description;
		}
	}
</script>
