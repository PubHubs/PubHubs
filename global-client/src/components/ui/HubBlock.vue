<template>
	<div
		v-if="hub"
		class="bg-background relative flex h-60 w-full max-w-full flex-col overflow-hidden rounded-xl shadow-md hover:cursor-pointer"
		@click="enterHub(hub)"
	>
		<Button
			v-if="contact"
			class="absolute! top-2 right-2 z-40 flex h-10 w-10 items-center justify-center rounded-xl border border-black bg-white"
			@click="toggleDescription($event)"
		>
			<Icon
				class="text-black"
				size="lg"
				:type="showDescription ? 'x' : 'info'"
			/>
		</Button>
		<div
			v-if="showDescription"
			class="global-preview bg-background absolute top-0 right-0 z-30 h-full max-h-60 w-full overflow-y-auto rounded-xl p-4"
		>
			<H3>{{ $t('home.contact_details') }}</H3>
			<mavon-editor
				v-model="contact"
				:box-shadow="false"
				default-open="preview"
				:subfield="false"
				:toolbars-flag="false"
			/>
		</div>
		<div
			v-if="!showDescription"
			class="h-24 w-full"
		>
			<HubBanner
				:banner-url="hub.bannerUrl"
				:hub-name="hub.name"
			/>
		</div>
		<div class="flex h-min items-start gap-4 px-4 py-2">
			<div class="bg-surface-high -mt-8 aspect-square h-16 w-16 overflow-clip rounded-xl">
				<HubIcon
					:hub-name="hub.name"
					:icon-url="hub.iconUrlLight"
					:icon-url-dark="hub.iconUrlDark"
				/>
			</div>
			<div class="flex h-full w-full max-w-full flex-col justify-center gap-2 overflow-hidden pt-1 pb-2 text-left">
				<H2 class="line-clamp-1 w-full overflow-hidden text-ellipsis">
					{{ hub.hubName }}
				</H2>
				<div class="h-16">
					<TruncatedText class="text-label-small font-bold uppercase">
						{{ $t('home.hub_card_about') }}
					</TruncatedText>
					<Pre
						v-model="summary"
						class="font-body max-w-[calc(100%-2em)] wrap-break-word hyphens-auto whitespace-pre-line"
						:class="isMobile ? 'line-clamp-3 text-xl' : 'line-clamp-2'"
						>{{ summary }}</Pre
					>
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { computed, onBeforeMount, onMounted, onUnmounted, ref } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { useRouter } from 'vue-router';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import Pre from '@hub-client/components/elements/Pre.vue';
	import TruncatedText from '@hub-client/components/elements/TruncatedText.vue';
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
	const settings = useSettings();
	const { t } = useI18n();
	const _mss = useMSS();
	const _global = useGlobal();

	const isMobile = computed(() => settings.isMobileState);
	const summary = ref<string>('');
	const contact = ref<string>('');
	const showDescription = ref(false);

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

	function toggleDescription(event: Event) {
		event.stopPropagation();
		showDescription.value = !showDescription.value;
	}

	function handleGlobalClick() {
		showDescription.value = false;
	}
	onBeforeMount(() => {
		loadHubSettings(props.hub);
	});

	onMounted(() => {
		document.addEventListener('click', handleGlobalClick);
	});

	onUnmounted(() => {
		document.removeEventListener('click', handleGlobalClick);
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
