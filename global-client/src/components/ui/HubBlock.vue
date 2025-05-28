<template>
	<div v-if="hub" class="relative flex h-60 w-full max-w-full flex-col overflow-hidden rounded-xl bg-background shadow-md hover:cursor-pointer" @click="enterHub(hub)">
		<Button v-if="contact" class="!btn-white !absolute right-2 top-2 z-40 flex h-10 w-10 items-center justify-center rounded-xl border border-black bg-white" @click="toggleDescription($event)">
			<Icon :type="showDescription ? 'hubBlockCross' : 'hubBlockInfo'" />
		</Button>
		<div v-if="showDescription" class="absolute right-0 top-0 z-30 h-full max-h-60 w-full overflow-y-auto rounded-xl bg-background p-4">
			<H3>{{ $t('home.contact_details') }}</H3>
			<Pre v-model="contact" class="whitespace-pre-line break-all">{{ contact }}</Pre>
		</div>
		<div v-if="!showDescription" class="h-24 w-full">
			<HubBanner :banner-url="hub.bannerUrl" :hub-name="hub.name" />
		</div>
		<div class="flex h-min items-start gap-4 px-4 py-2">
			<div class="-mt-8 aspect-square h-16 w-16 overflow-clip rounded-xl bg-surface-high">
				<HubIcon :icon-url="hub.iconUrlLight" :icon-url-dark="hub.iconUrlDark" :hub-name="hub.name" />
			</div>
			<div class="flex h-full w-full max-w-full flex-col justify-center gap-2 overflow-hidden pb-2 pt-1 text-left">
				<H2 class="line-clamp-1 w-full overflow-hidden text-ellipsis">{{ hub.hubName }}</H2>
				<div class="h-16">
					<TruncatedText class="font-bold uppercase ~text-label-small-min/label-small-max">{{ $t('home.hub_card_about') }}</TruncatedText>
					<Pre v-model="summary" class="max-w-[calc(100%_-_2em)] hyphens-auto whitespace-pre-line break-words font-body" :class="isMobile ? 'line-clamp-3 text-xl' : 'line-clamp-2'">{{ summary }}</Pre>
				</div>
			</div>
		</div>
	</div>
</template>
<script setup lang="ts">
	import { ref, onMounted, onUnmounted, onBeforeMount, computed } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { useRouter } from 'vue-router';
	import { useDialog } from '@/logic/store/store';
	import { Hub } from '@/model/Hubs';
	import HubIcon from '../../../../hub-client/src/components/ui/HubIcon.vue';
	import HubBanner from '../../../../hub-client/src/components/ui/HubBanner.vue';
	import Button from '../../../../hub-client/src/components/elements/Button.vue';
	import TruncatedText from '../../../../hub-client/src/components/elements/TruncatedText.vue';
	import Pre from '../../../../hub-client/src/components/elements/Pre.vue';
	import { useSettings } from '@/logic/store/store';

	const router = useRouter();
	const dialog = useDialog();
	const { t } = useI18n();
	const showDescription = ref(false);
	const props = defineProps<{ hub: Hub }>();
	const settings = useSettings();
	const isMobile = computed(() => settings.isMobileState);

	const summary = ref<string>('');
	const contact = ref<string>('');

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
		if (event) {
			event.stopPropagation();
		}
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
		}
	}
</script>
