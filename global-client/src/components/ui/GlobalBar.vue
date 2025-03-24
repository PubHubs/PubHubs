<template>
	<div id="pubhubs-bar" class="h-screen w-16 flex-none flex-shrink-0 flex-col bg-surface md:flex md:w-24" :class="{ hidden: !toggleMenu.globalIsActive }">
		<Modal :show="global.isModalVisible">
			<div class="flex h-full flex-col">
				<!-- Global top bar (discover) -->
				<div class="flex aspect-square w-full items-center justify-center bg-surface-high p-3 md:p-4">
					<router-link to="/" class="w-full">
						<figure class="group flex items-center justify-center rounded-[25%] bg-background p-1 hover:bg-accent-primary dark:bg-on-surface dark:hover:bg-accent-primary">
							<svg
								viewBox="0 0 24 24"
								fill="transparent"
								stroke="currentColor"
								stroke-linecap="round"
								stroke-linejoin="round"
								v-html="icons['pubhubs-home']"
								class="aspect-square w-full text-on-accent-secondary group-hover:text-accent-primary"
								@click="toggleMenu.hideMenuAndSendToHub()"
							></svg>
						</figure>
					</router-link>
				</div>

				<div class="flex flex-1 flex-col gap-1 py-3 md:gap-4 md:py-6">
					<!-- Global middle bar (hub menu) -->
					<div class="flex-1 overflow-y-auto px-2 md:gap-2 md:px-4">
						<HubMenu :hubOrderingIsActive="hubOrdering" />
					</div>

					<!-- Global bottom bar (settings) -->
					<div class="flex h-fit w-full flex-col gap-4 self-end px-2">
						<div v-if="global.loggedIn">
							<div class="flex w-full flex-wrap items-center justify-center gap-2">
								<GlobalbarButton type="reorder_hubs" @click="toggleHubOrdering" :class="hubOrdering && '!bg-accent-primary !text-on-accent-primary hover:!bg-accent-secondary'" />
								<GlobalbarButton type="cog" @click="settingsDialog = true" />
								<GlobalbarButton type="question_mark" @click="showHelp" />
								<GlobalbarButton type="power" @click="logout" />
							</div>
						</div>
						<a :href="pubHubsUrl" target="_blank" rel="noopener noreferrer">
							<Logo />
						</a>
					</div>
				</div>
			</div>
		</Modal>
	</div>

	<!-- Dialogs -->
	<SettingsDialog v-if="settingsDialog" @close="settingsDialog = false" />
</template>

<script setup lang="ts">
	// Package imports
	import { ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Global imports
	import SettingsDialog from '@/components/forms/SettingsDialog.vue';
	import HubMenu from '@/components/ui/HubMenu.vue';
	import Logo from '@/components/ui/Logo.vue';
	import { useDialog, useGlobal } from '@/logic/store/store';
	import { useToggleMenu } from '@/logic/store/toggleGlobalMenu';
	import GlobalbarButton from '@/components/ui/GlobalbarButton.vue';

	// Hub imports
	import { icons } from '@/../../hub-client/src/assets/icons';

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
