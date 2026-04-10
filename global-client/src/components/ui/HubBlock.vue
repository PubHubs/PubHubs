<template>
	<div
		v-if="hub"
		class="bg-surface ring-accent-secondary relative flex w-full max-w-full flex-col overflow-hidden rounded-xl hover:cursor-pointer hover:ring-3"
		@click="enterHub(hub)"
	>
		<span
			v-if="contact"
			class="bg-on-surface-bright text-surface-base absolute top-2 right-2 z-40 flex cursor-pointer items-center justify-center rounded-full p-[1px]"
			:title="copied ? t('home.contact_copied') : contact"
			@click.stop="copyContact"
		>
			<Icon :type="copied ? 'check' : 'info'" />
		</span>
		<div class="bg-surface-high h-24 w-full shrink-0">
			<HubBanner
				:banner-url="hub.bannerUrl"
				:hub-name="hub.name"
				class="h-full! w-full"
			/>
		</div>
		<div class="flex h-30 items-start gap-4 p-5 sm:p-6">
			<div class="bg-surface-high aspect-square h-12 w-12 shrink-0 overflow-clip rounded-xl">
				<HubIcon
					:hub-name="hub.name"
					:icon-url="hub.iconUrlLight"
					:icon-url-dark="hub.iconUrlDark"
				/>
			</div>
			<div class="flex min-w-0 flex-col gap-1 pr-4">
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
