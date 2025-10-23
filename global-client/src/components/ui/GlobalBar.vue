<template>
	<div id="pubhubs-bar" class="h-[100svh] flex-none flex-shrink-0 flex-col bg-surface" :class="[{ hidden: !toggleMenu.globalIsActive && isMobile }, isMobile ? 'w-[7.5rem]' : 'flex w-[10rem]']">
		<Modal :show="global.isModalVisible">
			<div class="flex h-full w-full max-w-[100svh] flex-col overflow-y-hidden">
				<!-- Global top bar (discover) -->
				<div class="flex aspect-square w-full items-center justify-center bg-surface-high">
					<router-link to="/">
						<Icon type="compass" @click="toggleMenu.hideMenuAndSendToHub()" size="3xl"></Icon>
					</router-link>
				</div>

				<div class="flex h-full flex-1 flex-col gap-1 overflow-y-hidden py-3 md:gap-4 md:py-6">
					<!-- Global middle bar (hub menu) -->
					<HubMenu :hubOrderingIsActive="hubOrdering && global.loggedIn" />

					<!-- Global bottom bar (settings) -->
					<div class="flex h-fit w-full flex-col gap-8 self-end px-4">
						<div v-if="global.loggedIn" class="flex flex-col items-center gap-4">
							<GlobalbarButton type="dots-three-vertical" size="xl" @click="toggleHubOrdering" :class="hubOrdering && '!bg-accent-primary !text-on-accent-primary hover:!bg-accent-secondary'" />
							<GlobalbarButton type="sliders-horizontal" size="xl" @click="openSettingsDialog" />
							<!-- <GlobalbarButton type="question_mark" @click="showHelp" /> -->
							<GlobalbarButton type="sign-out" size="xl" @click="logout" />
						</div>
						<a :href="globalClientUrl" target="_blank" rel="noopener noreferrer">
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
	import { useDialog, useGlobal, useMSS, useSettings } from '@/logic/store/store';
	import { useToggleMenu } from '@/logic/store/toggleGlobalMenu';
	import GlobalbarButton from '@/components/ui/GlobalbarButton.vue';

	// Hub imports
	import { icons } from '@/../../hub-client/src/assets/icons';

	const dialog = useDialog();
	const { t } = useI18n();
	const global = useGlobal();
	const toggleMenu = useToggleMenu();
	const settings = useSettings();
	const mss = useMSS();

	const settingsDialog = ref(false);
	const hubOrdering = ref(false);

	const globalClientUrl = _env.PUBHUBS_URL;

	const isMobile = computed(() => settings.isMobileState);

	async function logout() {
		if (await dialog.yesno(t('logout.logout_sure'))) {
			await global.logout();
		}
	}

	async function toggleHubOrdering() {
		// Check if the user still has a valid authentication token before enabling the hubOrdering mode
		const validAuthToken = await mss.hasValidAuthToken();
		if (validAuthToken && !global.hubsLoading) {
			hubOrdering.value = !hubOrdering.value;
		}
	}

	async function openSettingsDialog() {
		// Check if the user still has a valid authentication token before opening the settings dialog
		const validAuthToken = await mss.hasValidAuthToken();
		if (validAuthToken) {
			settingsDialog.value = true;
		}
	}

	function showHelp() {
		dialog.confirm(t('others.help'), t('others.work_in_progress'));
	}
</script>
