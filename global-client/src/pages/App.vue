<template>
	<div :class="settings.getActiveTheme" class="h-full">
		<div class="h-full text-black dark:bg-gray-darker dark:text-white">
			<div v-if="!($route.name === 'onboarding')" class="2md:hidden w-16 h-16 absolute -mt-1 dark:text-black text-white" @click="toggleMenu.toggleMenuAndSendToHub()">
				<Icon v-if="toggleMenu.globalIsActive" type="returnmenu" size="2xl" viewBox="0,0,69,63" class="stroke-0 fill-gray-dark dark:fill-white"></Icon>
				<Icon v-if="!toggleMenu.globalIsActive && !global.isModalVisible" type="hamburgermenu" size="2xl" viewBox="0,0,69,63" class="stroke-0 fill-gray-dark dark:fill-white"></Icon>
			</div>
			<div class="flex h-full">
				<GlobalBar v-if="!($route.name === 'onboarding')"></GlobalBar>
				<div v-if="hubs.hasHubs" class="flex-1 dark:bg-gray-dark overflow-y-auto scrollbar">
					<router-view></router-view>
				</div>
			</div>
		</div>

		<Dialog v-if="dialog.visible" @close="dialog.close"></Dialog>
	</div>
</template>

<script setup lang="ts">
	import { HubList, useDialog, useGlobal, useHubs, useSettings } from '@/store/store';
	import { useToggleMenu } from '@/store/toggleGlobalMenu';
	import { onMounted, watchEffect } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { SMI } from '../../../hub-client/src/dev/StatusMessage';
	import { Logger } from '@/../../hub-client/src/dev/Logger';

	const LOGGER = new Logger('GC');

	const global = useGlobal();
	const settings = useSettings();
	const hubs = useHubs();
	const dialog = useDialog();
	const { locale, availableLocales } = useI18n();
	const toggleMenu = useToggleMenu();

	onMounted(async () => {
		LOGGER.log(SMI.STARTUP_TRACE, 'App.vue onMounted...');

		settings.initI18b({ locale: locale, availableLocales: availableLocales });
		dialog.asGlobal();

		// Change active language to the user's preferred language
		locale.value = settings.getActiveLanguage;

		// set language when changed
		settings.$subscribe(() => {
			locale.value = settings.getActiveLanguage;
		});

		if (await global.checkLoginAndSettings()) {
			// Watch for saved state changes and save to backend.
			watchEffect(() => global.saveGlobalSettings());
		}
		await addHubs();

		LOGGER.log(SMI.STARTUP_TRACE, 'App.vue onMounted done', { language: settings.getActiveLanguage });
	});

	async function addHubs() {
		const hubsResponse: HubList | undefined = await global.getHubs();
		if (hubsResponse) {
			hubs.addHubs(hubsResponse as HubList);
		}
	}
</script>
