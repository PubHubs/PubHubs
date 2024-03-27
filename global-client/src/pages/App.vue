<template>
	<div :class="settings.getActiveTheme">
		<div class="h-screen text-black dark:bg-gray-darker dark:text-white">
			<div class="2md:hidden w-20 h-20 absolute" @click="toggleMenu.toggleMenu()">
				<Icon v-if="toggleMenu.globalIsActive" type="returnmenu" size="4xl" class="fill-[#2F2E2E] stroke-white dark:fill-white dark:stroke-black" viewBox="0,0,84,84"></Icon>
				<Icon v-else type="hamburgermenu" size="4xl" class="dark:fill-[#2F2E2E] dark:stroke-white fill-white stroke-black" viewBox="0,0,84,84"></Icon>
			</div>
			<div class="flex h-full">
				<div id="pubhubs-bar" class="flex-none w-32 bg-ph-background-2 h-screen pt-20 2md:pt-2 2md:block" :class="{ hidden: !toggleMenu.globalIsActive }">
					<Modal :show="global.isModalVisible">
						<div class="flex flex-col justify-between h-full">
							<div class="flex-1 text-center">
								<router-link to="/" v-slot="{ isActive }">
									<HubIcon type="pubhubs-home" :active="isActive" class="text-blue dark:text-white" @click="toggleMenu.toggleMenu()"></HubIcon>
								</router-link>

								<Line v-if="global.loggedIn && global.hasPinnedHubs" class="m-6 mt-8"></Line>
								<HubMenu></HubMenu>
								<Line v-if="global.loggedIn" class="m-6 mt-8"></Line>
							</div>

							<div class="mx-6">
								<div v-if="global.loggedIn">
									<SettingsDialog v-if="settingsDialog" @close="settingsDialog = false"></SettingsDialog>
									<div class="flex justify-between">
										<HubIcon type="cog" size="lg" @click="settingsDialog = true"></HubIcon>
										<HubIcon type="power" size="lg" @click="logout()"></HubIcon>
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
	import { onMounted, ref } from 'vue';
	import { useGlobal, useSettings, HubList, useHubs, useDialog } from '@/store/store';
	import { useI18n } from 'vue-i18n';
	import { useToggleMenu } from '@/store/toggleGlobalMenu';

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
		console.clear();
		settings.initI18b({ locale: locale, availableLocales: availableLocales });
		dialog.asGlobal();

		if (await global.checkLoginAndSettings()) {
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
