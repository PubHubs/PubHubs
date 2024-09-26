<template>
	<div id="pubhubs-bar" class="flex-none w-32 bg-ph-background-3 dark:bg-ph-background-5 h-full pt-20 2md:pt-2 2md:block" :class="{ hidden: !toggleMenu.globalIsActive }">
		<Modal :show="global.isModalVisible">
			<div class="flex flex-col justify-between h-full">
				<div class="flex-1 text-center w-fit mx-auto">
					<router-link to="/">
						<Icon type="pubhubs-home" size="3xl" class="text-white mx-auto" @click="toggleMenu.hideMenuAndSendToHub()"></Icon>
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

					<a :href="pubHubsUrl" class="m-2 sm:m-4">
						<Logo :global="true"></Logo>
					</a>
				</div>
			</div>
		</Modal>
	</div>
</template>

<script setup lang="ts">
	import { useDialog, useGlobal } from '@/store/store';
	import { useToggleMenu } from '@/store/toggleGlobalMenu';
	import { ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	const dialog = useDialog();
	const settingsDialog = ref(false);
	const { t } = useI18n();
	const global = useGlobal();
	const toggleMenu = useToggleMenu();

	// eslint-disable-next-line
	const pubHubsUrl = _env.PUBHUBS_URL;

	async function logout() {
		if (await dialog.yesno(t('logout.logout_sure'))) {
			global.logout();
		}
	}
</script>
