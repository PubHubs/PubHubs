<template>
	<!-- HubLogo with unreadmessages marker -->
	<div
		v-if="hub"
		:class="{ 'border-4 border-on-accent-secondary bg-on-accent-secondary': active && !hubOrderingIsActive }"
		class="group relative z-0 block aspect-square w-full cursor-pointer rounded-xl text-center transition-all ease-in-out"
		:title="hub.name"
	>
		<div :class="{ 'border-r-4 border-t-4 border-on-accent-secondary bg-on-accent-secondary': active && !hubOrderingIsActive }" class="absolute -right-2 top-1/3 -z-10 h-4 w-4 rotate-45"></div>
		<div v-if="hub && hub.unreadMessages > 0 && !hubOrderingIsActive && !settings.isFeatureEnabled(FeatureFlag.unreadCounter)" class="absolute -right-1 -top-1 z-10 group-hover:hidden">
			<Badge class="~text-label-small-min/label-small-max" color="ph" v-if="hub.unreadMessages > 99">99+</Badge>
			<Badge color="ph" v-else>{{ hub.unreadMessages }}</Badge>
		</div>

		<div v-show="hub && !hubOrderingIsActive && accessToken && settings.isFeatureEnabled(FeatureFlag.unreadCounter)" class="absolute -right-1 -top-1 z-10">
			<iframe :src="hub.url + '/miniclient.html?accessToken=' + accessToken" class="h-7 w-7" :id="miniClientId + '_' + hubId"></iframe>
		</div>

		<HubIcon :hub-name="hub.name" :icon-url="hub.iconUrlLight" :icon-url-dark="hub.iconUrlDark" :is-active="active" />
	</div>
</template>

<script setup lang="ts">
	// Package imports
	import { ref } from 'vue';

	// Global imports
	import { useGlobal } from '@/logic/store/global';
	import { useMessageBox, miniClientId } from '@/logic/store/messagebox';
	import { useSettings, FeatureFlag } from '@/logic/store/settings';
	import { useHubs } from '@/logic/store/hubs';
	import { Hub } from '@/model/Hubs';

	// Hub imports
	import Badge from '@/../../hub-client/src/components/elements/Badge.vue';
	import HubIcon from '@/../../hub-client/src/components/ui/HubIcon.vue';

	const global = useGlobal();
	const messagebox = useMessageBox();
	const settings = useSettings();
	const hubs = useHubs();

	type Props = {
		type?: string;
		size?: string;
		hub?: Hub;
		hubId: string;
		pinned?: boolean;
		pinnable?: boolean;
		active?: boolean;
		hubOrderingIsActive?: boolean;
	};

	const props = withDefaults(defineProps<Props>(), {
		type: 'circle',
		size: 'xl',
		hub: undefined,
		hubId: '',
		pinned: false,
		pinnable: false,
		active: false,
		hubOrderingIsActive: false,
	});

	hubs.setupMiniclient(props.hubId);

	const accessToken = settings.isFeatureEnabled(FeatureFlag.multiServerSetup) ? ref<string>(JSON.stringify(global.getAuthInfo(props.hubId))) : ref<string | null>(global.getAccessToken(props.hubId));

	// When a user opens the hub for the first time on a device or in a browser, the accessToken is
	// only stored after the receivedMessage action with a message of type addAccessToken from
	// the messageBox is finished.
	messagebox.$onAction(({ name, args, after }) => {
		if (name === 'receivedMessage' && args[0].type === 'addAccessToken') {
			after(() => {
				accessToken.value = global.getAccessToken(props.hubId);
			});
		}
	});

	// When a user opens the hub for the first time on a device or in a browser, the accessToken
	// and userId are only stored after the receivedMessage action with a message of type addAuthInfo
	// from the messageBox is finished.
	messagebox.$onAction(({ name, args, after }) => {
		if (name === 'receivedMessage' && args[0].type === 'addAuthInfo') {
			after(() => {
				const authInfo = global.getAuthInfo(props.hubId);
				accessToken.value = JSON.stringify(authInfo);
			});
		}
	});
</script>
