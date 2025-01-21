<template>
	<div id="pubhubs-bar" class="flex-none w-24 bg-ph-background-3 dark:bg-gray-darker h-full pt-20 2md:pt-0 2md:block" :class="{ hidden: !toggleMenu.globalIsActive }">
		<Modal :show="global.isModalVisible">
			<div class="flex flex-col justify-between h-full">
				<div class="dark:bg-ph-background-5 bg-ph-background-4 h-24 grid items-center justify-center">
					<router-link to="/">
						<div class="w-14 h-14 flex justify-center items-center bg-white text-white hover:text-lightgray-light hover:bg-lightgray-light rounded-xl">
							<Icon type="pubhubs-home" size="xl" @click="toggleMenu.hideMenuAndSendToHub()"></Icon>
						</div>
					</router-link>
				</div>
				<div class="flex-1 h-full w-full mx-auto overflow-hidden">
					<HubMenu :hubOrderingIsActive="hubOrdering"></HubMenu>
				</div>

				<div class="grid gap-4 p-2 pb-4 h-fit">
					<div v-if="global.loggedIn">
						<SettingsDialog v-if="settingsDialog" @close="settingsDialog = false"></SettingsDialog>
						<div class="grid grid-cols-2 gap-2 w-fit mx-auto">
							<Icon type="question_mark" class="p-1 rounded-sm dark:bg-gray dark:hover:bg-gray-dark bg-gray-lighter hover:bg-gray-light hover:cursor-pointer" size="base" @click="showHelp()"></Icon>
							<div class="relative">
								<Icon
									type="reorder_hubs"
									:class="{ 'bg-white dark:hover:bg-lightgray-light text-black': hubOrdering }"
									class="p-1 rounded-sm dark:bg-gray bg-gray-lighter hover:bg-white dark:hover:bg-lightgray-light hover:text-black hover:cursor-pointer"
									size="base"
									@click="toggleHubOrdering()"
								></Icon>
								<DialogBubble class="absolute -top-2/3 left-[150%]" :showBubble="hubOrdering">
									{{ t('bubble.organize') }}
								</DialogBubble>
							</div>
							<Icon type="cog" class="p-1 rounded-sm dark:bg-gray dark:hover:bg-gray-dark bg-gray-lighter hover:bg-gray-light hover:cursor-pointer" size="base" @click="settingsDialog = true"></Icon>
							<Icon type="power" class="p-1 rounded-sm dark:bg-gray dark:hover:bg-gray-dark bg-gray-lighter hover:bg-gray-light hover:cursor-pointer" size="base" @click="logout()"></Icon>
						</div>
					</div>
					<a :href="pubHubsUrl">
						<Logo class="px-1"></Logo>
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

	// Components
	import DialogBubble from '../../../../hub-client/src/components/ui/DialogBubble.vue';
	import Logo from '../../../../hub-client/src/components/ui/Logo.vue';

	const dialog = useDialog();
	const settingsDialog = ref(false);
	const { t } = useI18n();
	const global = useGlobal();
	const toggleMenu = useToggleMenu();
	const hubOrdering = ref(false);

	// eslint-disable-next-line
	const pubHubsUrl = _env.PUBHUBS_URL;

	async function logout() {
		if (await dialog.yesno(t('logout.logout_sure'))) {
			global.logout();
		}
	}

	function toggleHubOrdering() {
		hubOrdering.value = !hubOrdering.value;
	}

	function showHelp() {
		dialog.okcancel('Help?', 'Rescue in progress');
	}
</script>
