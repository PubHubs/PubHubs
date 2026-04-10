<template>
	<MiniclientLinked v-if="hubActive === true" />
	<MiniclientIndependent v-else-if="hubActive === false" />
</template>

<script setup lang="ts">
	/**
	 * Outer shell of the miniclient iframe. Decides whether to render
	 * MiniclientIndependent (runs its own MatrixClient, used when the hub is
	 * NOT the currently active one and in solo mode) or MiniclientLinked
	 * (pure display, mirrors the active hub client's aggregate unread state
	 * pushed via messagebox).
	 *
	 * Rendering uses `hubActive` as a tri-state:
	 *   undefined → don't render anything yet (handshake with the global
	 *               client hasn't completed, so we don't know which mode
	 *               this miniclient should be in)
	 *   true      → render MiniclientLinked
	 *   false     → render MiniclientIndependent
	 *
	 * This matters because MiniclientIndependent's setup calls
	 * setupUnreadAggregateTracking → loadUnreadInfoCache, which round-trips
	 * to the global client via the LocalStore protocol and would be a no-op
	 * if fired before the handshake. Child onMounted runs before parent
	 * onMounted, so we cannot rely on Independent to await the handshake
	 * itself — the outer must gate rendering by leaving hubActive undefined
	 * until the handshake resolves.
	 *
	 * The HubActive callback is registered at setup time, BEFORE the
	 * handshake completes, so the first HubActive the parent sends after
	 * handshake is not missed. In the most common "first load of an
	 * already-active hub" case, HubActive(true) arrives and the callback
	 * sets hubActive before the handshake-driven fallback runs — Independent
	 * is never mounted and no wasted sync fires.
	 *
	 * Solo iframe mode, which the 26-miniclient-badge e2e test relies on,
	 * never receives HubActive and is bootstrapped with hubActive=false so
	 * it goes straight to MiniclientIndependent.
	 */
	// Packages
	import { onMounted, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Logic
	import { createLogger } from '@hub-client/logic/logging/Logger';

	// Components
	import MiniclientIndependent from '@hub-client/pages/MiniclientIndependent.vue';
	import MiniclientLinked from '@hub-client/pages/MiniclientLinked.vue';

	// Stores
	import { useHubSettings } from '@hub-client/stores/hub-settings';
	import { type Message, MessageBoxType, MessageType, useMessageBox } from '@hub-client/stores/messagebox';
	import { useSettings } from '@hub-client/stores/settings';

	const logger = createLogger('Miniclient');
	const hubSettings = useHubSettings();
	const messagebox = useMessageBox();
	const settings = useSettings();
	const { locale, availableLocales } = useI18n();

	const hubActive = ref<boolean | undefined>(hubSettings.isSolo ? false : undefined);

	messagebox.addCallback('parentFrame', MessageType.HubActive, (message: Message) => {
		const content = message.content as { active?: boolean };
		hubActive.value = content.active === true;
		logger.debug(`HubActive → ${hubActive.value}`);
	});

	onMounted(async () => {
		logger.debug('Miniclient.vue onMounted');
		settings.initI18b({ locale: locale, availableLocales: availableLocales });
		if (!hubSettings.isSolo) {
			messagebox.init(MessageBoxType.Child);
			await messagebox.startCommunication(hubSettings.parentUrl);
			// Fallback: if no HubActive message arrived during the handshake
			// (e.g. old global client without this protocol), default to
			// Independent so the miniclient still shows something.
			if (hubActive.value === undefined) hubActive.value = false;
		}
	});
</script>

<style>
	body {
		margin: 0;
	}
</style>
