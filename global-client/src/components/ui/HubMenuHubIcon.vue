<template>
	<!-- HubLogo with unreadmessages marker -->
	<div
		v-if="hub"
		:class="{ 'border-4 border-on-accent-secondary bg-on-accent-secondary': active && !hubOrderingIsActive }"
		class="group relative z-0 block aspect-square h-16 w-full cursor-pointer rounded-xl text-center transition-all ease-in-out"
		:title="hub.name"
	>
		<div :class="{ 'border-r-4 border-t-4 border-on-accent-secondary bg-on-accent-secondary': active && !hubOrderingIsActive }" class="absolute -right-2 top-1/3 -z-10 h-4 w-4 rotate-45"></div>
		<div v-if="hub && hub.unreadMessages > 0 && !hubOrderingIsActive && !settings.isFeatureEnabled(FeatureFlag.unreadCounter)" class="absolute -right-1 -top-1 z-10 group-hover:hidden">
			<Badge class="text-label-small" color="ph" v-if="hub.unreadMessages > 99">99+</Badge>
			<Badge color="ph" v-else>{{ hub.unreadMessages }}</Badge>
		</div>

		<div v-show="hub && !hubOrderingIsActive && accessToken && settings.isFeatureEnabled(FeatureFlag.unreadCounter)" class="absolute -right-1 -top-1 z-10">
			<iframe :src="hub.url + '/miniclient.html?accessToken=' + accessToken" class="pointer-events-none h-7 w-7" :id="miniClientId + '_' + hubId"></iframe>
		</div>

		<HubIcon :hub-name="hub.name" :icon-url="hub.iconUrlLight" :icon-url-dark="hub.iconUrlDark" :is-active="active" />
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { ref } from 'vue';

	// Components
	import Badge from '@hub-client/components/elements/Badge.vue';
	import HubIcon from '@hub-client/components/ui/HubIcon.vue';

	// Models
	import { Hub } from '@global-client/models/Hubs';

	// Stores
	import { useGlobal } from '@global-client/stores/global';
	import { useHubs } from '@global-client/stores/hubs';

	import { miniClientId, useMessageBox } from '@hub-client/stores/messagebox';
	import { FeatureFlag, useSettings } from '@hub-client/stores/settings';

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

	const global = useGlobal();
	const messagebox = useMessageBox();
	const settings = useSettings();
	const hubs = useHubs();

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

	const accessToken = ref<string>(JSON.stringify(global.getAuthInfo(props.hubId)));

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
