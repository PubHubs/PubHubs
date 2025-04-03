<template>
	<div v-if="hub" class="relative flex h-60 w-full max-w-full flex-col overflow-hidden rounded-xl bg-background shadow-md hover:cursor-pointer" @click="enterHub(hub)">
		<div class="h-24 w-full">
			<ImagePlaceholder source="/client/img/imageplaceholder.jpg" />
		</div>
		<div class="flex h-min items-start gap-4 px-4 py-2">
			<div class="-mt-8 aspect-square h-16 w-16 overflow-clip rounded-xl bg-surface-high">
				<HubIcon :icon-url="hub.iconUrlLight" :icon-url-dark="hub.iconUrlDark" :hub-name="hub.name" />
			</div>
			<div class="flex h-full w-full max-w-full flex-col justify-center gap-2 overflow-hidden pb-2 pt-1 text-left">
				<H2 class="line-clamp-1 w-full overflow-hidden text-ellipsis">{{ hub.hubName }}</H2>
				<div class="h-16">
					<TruncatedText class="font-bold uppercase ~text-label-small-min/label-small-max">{{ $t('home.hub_card_about') }}</TruncatedText>
					<p class="line-clamp-2 max-w-[calc(100%_-_2em)] hyphens-auto break-words" :lang="currentLanguage">{{ description }}</p>
				</div>
			</div>
		</div>
		<Button class="!absolute bottom-4 right-4 flex aspect-square w-min items-center justify-center rounded-md !p-1">
			<Icon type="arrow-right" size="sm" @click="enterHub(hub)" />
		</Button>
	</div>
</template>

<script setup lang="ts">
	import { computed } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { useRouter } from 'vue-router';

	import { useDialog } from '@/logic/store/store';
	import { Hub } from '@/model/Hubs';
	import HubIcon from '../../../../hub-client/src/components/ui/HubIcon.vue';
	import Button from '../../../../hub-client/src/components/elements/Button.vue';
	import ImagePlaceholder from '../../../../hub-client/src/components/elements/ImagePlaceholder.vue';

	const router = useRouter();
	const dialog = useDialog();

	const { t, locale } = useI18n();
	const currentLanguage = locale.value;

	const props = defineProps<{ hub: Hub }>();

	const description = computed(() => {
		if (props.hub.description !== '') {
			return props.hub.description;
		}
		return props.hub.hubId;
	});

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
</script>
