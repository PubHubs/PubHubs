<template>
	<div id="pubhubs-bar" class="h-full w-24 flex-none bg-ph-background-3 pt-20 dark:bg-gray-darker 2md:block 2md:pt-0" :class="{ hidden: !toggleMenu.globalIsActive }">
		<Modal :show="global.isModalVisible">
			<div class="flex h-full flex-col justify-between">
				<div class="grid h-24 items-center justify-center bg-ph-background-4 dark:bg-ph-background-5">
					<router-link to="/">
						<div class="flex h-14 w-14 items-center justify-center rounded-xl bg-white text-white hover:bg-lightgray-light hover:text-lightgray-light">
							<Icon type="pubhubs-home" size="xl" @click="toggleMenu.hideMenuAndSendToHub()"></Icon>
						</div>
					</router-link>
				</div>
				<div class="mx-auto h-full w-full flex-1 overflow-hidden">
					<HubMenu :hubOrderingIsActive="hubOrdering"></HubMenu>
				</div>

				<div class="grid h-fit gap-4 p-2 pb-4">
					<div v-if="global.loggedIn">
						<SettingsDialog v-if="settingsDialog" @close="settingsDialog = false"></SettingsDialog>
						<div class="mx-auto grid w-fit grid-cols-2 gap-2">
							<Icon type="question_mark" class="rounded-sm bg-gray-lighter p-1 hover:cursor-pointer hover:bg-gray-light dark:bg-gray dark:hover:bg-gray-dark" size="base" @click="showHelp()"></Icon>
							<div class="relative">
								<Icon
									type="reorder_hubs"
									:class="{ 'bg-white text-black dark:hover:bg-lightgray-light': hubOrdering }"
									class="rounded-sm bg-gray-lighter p-1 hover:cursor-pointer hover:bg-white hover:text-black dark:bg-gray dark:hover:bg-lightgray-light"
									size="base"
									@click="toggleHubOrdering()"
								></Icon>
								<DialogBubble class="absolute -top-2/3 left-[150%]" :showBubble="hubOrdering">
									{{ t('bubble.organize') }}
								</DialogBubble>
							</div>
							<Icon type="cog" class="rounded-sm bg-gray-lighter p-1 hover:cursor-pointer hover:bg-gray-light dark:bg-gray dark:hover:bg-gray-dark" size="base" @click="settingsDialog = true"></Icon>
							<Icon type="power" class="rounded-sm bg-gray-lighter p-1 hover:cursor-pointer hover:bg-gray-light dark:bg-gray dark:hover:bg-gray-dark" size="base" @click="logout()"></Icon>
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
		dialog.okcancel(t('others.help'), t('others.work_in_progress'));
	}
</script>
