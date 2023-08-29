<template>
	<div :class="settings.getActiveTheme">
		<div class="w-screen h-screen bg-white text-black dark:bg-gray-darker dark:text-white">
			<div class="flex">
				<div id="pubhubs-bar" class="flex-none w-20 sm:w-32 flex flex-col h-screen pt-2">
					<Modal :show="global.isModalVisible">
						<div class="flex-1 text-center">
							<router-link to="/" v-slot="{ isActive }">
								<HubIcon type="pubhubs-home" :active="isActive" class="text-blue dark:text-white"></HubIcon>
							</router-link>

							<Line v-if="global.loggedIn && global.hasPinnedHubs" class="m-2 sm:m-6 mt-8"></Line>
							<HubMenu></HubMenu>
							<Line v-if="global.loggedIn" class="m-2 sm:m-6 mt-8"></Line>
						</div>

						<div v-if="global.loggedIn">
							<Dialog v-if="settingsDialog" @close="settingsDialog = false" :title="$t('settings.title')" :buttons="buttonsSubmitCancel">
								<Settings></Settings>
							</Dialog>
							<div class="flex justify-center">
								<HubIcon type="cog" size="lg" @click="settingsDialog = true"></HubIcon>
								<HubIcon type="power" size="lg" @click="logout()"></HubIcon>
							</div>
						</div>

						<a :href="pubHubsUrl" class="m-2 sm:m-4"><Logo></Logo></a>
					</Modal>
				</div>

				<div v-if="hubs.hasHubs" class="flex-1 dark:bg-gray-dark">
					<router-view></router-view>
				</div>
			</div>
		</div>

		<Dialog v-if="dialog.visible" @close="dialog.close"></Dialog>
	</div>
</template>

<script setup lang="ts">
	import { onMounted, ref } from 'vue';
	import { useGlobal, useSettings, Hub, HubList, useHubs, buttonsSubmitCancel, useDialog } from '@/store/store';
	import { useI18n } from 'vue-i18n';

	const global = useGlobal();
	const settings = useSettings();
	const hubs = useHubs();
	const dialog = useDialog();
	const settingsDialog = ref(false);
	const { t, locale, availableLocales } = useI18n();

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
