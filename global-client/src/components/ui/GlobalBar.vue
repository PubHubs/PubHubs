<template>
	<div id="pubhubs-bar" class="h-[100svh] flex-none flex-shrink-0 flex-col bg-surface" :class="[{ hidden: !toggleMenu.globalIsActive && isMobile }, isMobile ? 'w-[7.5rem]' : 'flex w-[10rem]']">
		<Modal :show="global.isModalVisible">
			<div class="flex h-full w-full max-w-[100svh] flex-col overflow-y-hidden">
				<!-- Global top bar (discover) -->
				<div class="flex aspect-square w-full items-center justify-center bg-surface-high" :class="isMobile ? 'p-3' : 'p-4'">
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

				<div class="flex h-full flex-1 flex-col gap-1 overflow-y-hidden py-3 md:gap-4 md:py-6">
					<!-- Global middle bar (hub menu) -->
					<HubMenu :hubOrderingIsActive="hubOrdering" />

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
	import { ref, computed } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Global imports
	import SettingsDialog from '@/components/forms/SettingsDialog.vue';
	import HubMenu from '@/components/ui/HubMenu.vue';
	import Logo from '@/components/ui/Logo.vue';
	import { useDialog, useGlobal, useSettings } from '@/logic/store/store';
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
	const settings = useSettings();
	const isMobile = computed(() => settings.isMobileState);

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
		dialog.confirm(t('others.help'), t('others.work_in_progress'));
	}
</script>
