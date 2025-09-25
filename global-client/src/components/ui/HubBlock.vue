<template>
	<div v-if="hub" class="relative flex h-60 w-full max-w-full flex-col overflow-hidden rounded-xl bg-background shadow-md hover:cursor-pointer" @click="enterHub(hub)">
		<Button v-if="contact" class="!btn-white !absolute right-2 top-2 z-40 flex h-10 w-10 items-center justify-center rounded-xl border border-black bg-white" @click="toggleDescription($event)">
			<Icon :type="showDescription ? 'hubBlockCross' : 'hubBlockInfo'" />
		</Button>
		<div v-if="showDescription" class="global-preview absolute right-0 top-0 z-30 h-full max-h-60 w-full overflow-y-auto rounded-xl bg-background p-4">
			<H3>{{ $t('home.contact_details') }}</H3>
			<mavon-editor defaultOpen="preview" :toolbarsFlag="false" :subfield="false" v-model="contact" :boxShadow="false" />
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
	import { useDialog } from '@/logic/store/dialog';
	import { Hub } from '@/model/Hubs';
	import HubIcon from '../../../../hub-client/src/components/ui/HubIcon.vue';
	import HubBanner from '../../../../hub-client/src/components/ui/HubBanner.vue';
	import Button from '../../../../hub-client/src/components/elements/Button.vue';
	import TruncatedText from '../../../../hub-client/src/components/elements/TruncatedText.vue';
	import Pre from '../../../../hub-client/src/components/elements/Pre.vue';
	import { useSettings } from '@/logic/store/settings';
	import { useMSS } from '@/logic/store/mss';

	const router = useRouter();
	const dialog = useDialog();
	const settings = useSettings();
	const { t } = useI18n();
	const mss = useMSS();

	const props = defineProps<{ hub: Hub }>();

	const isMobile = computed(() => settings.isMobileState);

	const summary = ref<string>('');
	const contact = ref<string>('');
	const showDescription = ref(false);

	async function enterHub(hub: Hub) {
		let userLoggedIn = false;
		let hubRunning = false;
		try {
			// entering only the hub would generate a CORS-error.
			// Since we only need to know if the hub is running, we can send a no-cors.
			// The response will be empty, but the type 'opaque' will indicate the url is up and running
			const response = await fetch(hub.url, { mode: 'no-cors' });
			if (response.type === 'opaque') {
				hubRunning = false;
			}
			// Check if the user still has a valid authentication token before allowing the user to enter a hub
			const state = await mss.stateEP();
			if (state !== undefined) {
				userLoggedIn = true;
			}
		} catch {
			// intentionally left empty
		}
		if (userLoggedIn && !hubRunning) {
			router.push({ name: 'hub', params: { name: hub.name } });
		} else if (hubRunning) {
			await dialog.confirm(hub.name, t('hubs.under_construction'));
		}
		// If the user does not have a valid authentication token, the logout procedure will already be triggered by mss.stateEP()
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
