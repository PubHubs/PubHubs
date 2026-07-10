<template>
	<!-- HubLogo with unreadmessages marker -->
	<div
		v-if="hub"
		class="group relative z-0 block h-full w-full cursor-pointer rounded-xl text-center transition-all ease-in-out"
		:title="hub?.name"
		:data-rail-active="active || undefined"
	>
		<div
			v-show="hub && accessToken && settings.isFeatureEnabled(FeatureFlag.unreadCounter)"
			class="-top-050 -right-050 absolute z-10"
		>
			<iframe
				:id="miniClientId + '_' + hubId"
				class="pointer-events-none h-300 w-300 border-none"
				:src="miniclientSrc"
			/>
		</div>

		<!-- Inactive hubs are dimmed so the active one stands out; they brighten on hover to read as switch targets. -->
		<HubIcon
			class="transition-opacity duration-200"
			:class="active ? '' : 'opacity-60 group-hover:opacity-100'"
			:hub-name="hub.name"
			:icon-url="hub.iconUrlLight"
			:icon-url-dark="hub.iconUrlDark"
			:is-active="active"
		/>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { computed, ref } from 'vue';

	// Components
	import HubIcon from '@hub-client/components/ui/HubIcon.vue';

	// Logic
	import { cacheBust } from '@global-client/logic/utils/cacheBust';

	// Stores
	import { useGlobal } from '@global-client/stores/global';
	import { useHubs } from '@global-client/stores/hubs';

	import { miniClientId, useMessageBox } from '@hub-client/stores/messagebox';
	import { FeatureFlag, useSettings } from '@hub-client/stores/settings';

	type Props = {
		type?: string;
		size?: string;
		hubId: string;
		pinned?: boolean;
		pinnable?: boolean;
		active?: boolean;
	};

	const props = withDefaults(defineProps<Props>(), {
		type: 'circle',
		size: 'xl',
		hubId: '',
		pinned: false,
		pinnable: false,
		active: false,
	});
	const global = useGlobal();
	const messagebox = useMessageBox();
	const settings = useSettings();
	const hubs = useHubs();

	const hub = computed(() => hubs.hub(props.hubId));

	hubs.setupMiniclient(props.hubId);

	const accessToken = ref<string>(JSON.stringify(global.getAuthInfo(props.hubId)));
	const miniclientSrc = computed(
		() => `${hub.value?.url}/miniclient.html?${new URLSearchParams({ accessToken: accessToken.value, hubId: props.hubId, cb: cacheBust })}`,
	);

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
