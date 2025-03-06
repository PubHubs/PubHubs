<template>
	<div :class="settings.getActiveTheme" class="h-full min-w-[320px]">
		<div class="h-full text-black dark:bg-gray-darker dark:text-white">
			<MobileMenu></MobileMenu>

			<div class="flex h-full">
				<GlobalBar v-if="!($route.name === 'onboarding')"></GlobalBar>
				<div v-if="hubs.hasHubs" class="scrollbar flex-1 dark:bg-gray-dark" :class="{ 'overflow-y-auto': $route.name !== 'onboarding' }">
					<router-view></router-view>
				</div>
			</div>
		</div>

		<Dialog v-if="dialog.visible" @close="dialog.close"></Dialog>
	</div>
</template>

<script setup lang="ts">
	import { useDialog, useGlobal, useHubs, useSettings } from '@/logic/store/store';
	import { HubList } from '@/model/Hubs';
	import { onMounted, watchEffect } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { SMI } from '../../../hub-client/src/logic/foundation/StatusMessage';
	import { Logger } from '../../../hub-client/src/logic/foundation/Logger';
	import MobileMenu from '@/components/ui/MobileMenu.vue';
	import { CONFIG } from '../../../hub-client/src/logic/foundation/Config';
	import { NotificationsPermission } from '@/logic/store/settings';

	const LOGGER = new Logger('GC', CONFIG);

	const global = useGlobal();
	const settings = useSettings();
	const hubs = useHubs();
	const dialog = useDialog();
	const { locale, availableLocales } = useI18n();

	// Watch for changes in the permission for notifications by the user to reflect these changes once the user opens the settings dialog
	if ('permissions' in navigator) {
		navigator.permissions.query({ name: 'notifications' }).then(function (notificationPerm) {
			notificationPerm.onchange = function () {
				if (notificationPerm.state === 'prompt' || notificationPerm.state === 'denied') {
					settings.setNotificationPermission(NotificationsPermission.Deny);
				}
			};
		});
	}

	onMounted(async () => {
		LOGGER.log(SMI.STARTUP, 'App.vue onMounted...');

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

		LOGGER.log(SMI.STARTUP, 'App.vue onMounted done', { language: settings.getActiveLanguage });
	});

	async function addHubs() {
		const hubsResponse: HubList | undefined = await global.getHubs();
		if (hubsResponse) {
			hubs.addHubs(hubsResponse as HubList);
		}
	}
</script>
