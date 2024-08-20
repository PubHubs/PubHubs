<template>
	<div :class="settings.getActiveTheme">
		<div class="h-screen text-black dark:bg-gray-darker dark:text-white">
			<div class="2md:hidden w-16 h-16 absolute -mt-1 dark:text-black text-white" @click="toggleMenu.toggleMenu()">
				<Icon v-if="toggleMenu.globalIsActive" type="returnmenu" size="2xl" viewBox="0,0,69,63" class="stroke-0 fill-gray-dark dark:fill-white"></Icon>
				<Icon v-if="!toggleMenu.globalIsActive && !global.isModalVisible" type="hamburgermenu" size="2xl" viewBox="0,0,69,63" class="stroke-0 fill-gray-dark dark:fill-white"></Icon>
			</div>
			<div class="flex h-full">
				<div id="pubhubs-bar" class="flex-none w-32 bg-ph-background-3 dark:bg-ph-background-5 h-screen pt-20 2md:pt-2 2md:block" :class="{ hidden: !toggleMenu.globalIsActive }">
					<Modal :show="global.isModalVisible">
						<div class="flex flex-col justify-between h-full">
							<div class="flex-1 text-center w-fit mx-auto">
								<router-link to="/">
									<Icon type="pubhubs-home" size="3xl" class="text-white mx-auto" @click="toggleMenu.toggleMenu()"></Icon>
								</router-link>

								<Line v-if="global.loggedIn && global.hasPinnedHubs" class="m-6 mt-8"></Line>
								<HubMenu></HubMenu>
								<Line v-if="global.loggedIn" class="m-6 mt-8"></Line>
							</div>

							<div class="mx-6">
								<div v-if="global.loggedIn">
									<SettingsDialog v-if="settingsDialog" @close="settingsDialog = false"></SettingsDialog>
									<div class="flex justify-between">
										<Icon type="cog" class="text-dark" size="lg" @click="settingsDialog = true"></Icon>
										<Icon type="power" class="text-dark" size="lg" @click="logout()"></Icon>
									</div>
								</div>

								<a :href="pubHubsUrl" class="m-2 sm:m-4"><Logo :global="true"></Logo></a>
							</div>
						</div>
					</Modal>
				</div>

				<div v-if="hubs.hasHubs" class="flex-1 dark:bg-gray-dark overflow-y-auto">
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
	import { onMounted, ref } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { SMI } from '../../../hub-client/src/dev/StatusMessage';
	import { Logger } from '@/../../hub-client/src/dev/Logger';

	const LOGGER = new Logger('GC');

	const global = useGlobal();
	const settings = useSettings();
	const hubs = useHubs();
	const dialog = useDialog();
	const settingsDialog = ref(false);
	const { t, locale, availableLocales } = useI18n();
	const toggleMenu = useToggleMenu();

	// eslint-disable-next-line
	const pubHubsUrl = _env.PUBHUBS_URL;

	onMounted(async () => {
		LOGGER.log(SMI.STARTUP_TRACE, 'App.vue onMounted...');

		settings.initI18b({ locale: locale, availableLocales: availableLocales });
		dialog.asGlobal();

		if (await global.checkLoginAndSettings()) {
			// Change active language to the user's preferred language
			locale.value = settings.getActiveLanguage;

			// set language when changed
			settings.$subscribe(() => {
				locale.value = settings.getActiveLanguage;
			});

			// save settings when changed
			global.$subscribe(() => {
				global.saveGlobalSettings();
			});
			settings.$subscribe(() => {
				global.saveGlobalSettings();
			});
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

	async function logout() {
		if (await dialog.yesno(t('logout.logout_sure'))) {
			global.logout();
		}
	}
</script>
