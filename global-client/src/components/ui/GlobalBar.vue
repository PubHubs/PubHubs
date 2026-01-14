<template>
	<div class="border-on-surface-disabled relative flex h-full w-[80px] shrink-0 snap-start snap-always flex-col border-r">
		<Modal :show="global.isModalVisible">
			<div class="flex h-full w-full max-w-[100svh] flex-col overflow-y-hidden">
				<div class="border-on-surface-disabled flex aspect-square h-[80px] items-center justify-center border-b p-2">
					<router-link to="/" class="h-full">
						<img alt="PubHubs logo" :src="logoUrl" class="h-full w-full object-contain" />
					</router-link>
				</div>

				<div class="flex h-full flex-1 flex-col gap-1 overflow-y-hidden">
					<HubMenu :hubOrderingIsActive="hubOrdering && global.loggedIn" />

					<div class="flex h-fit w-full flex-col gap-8 self-end p-4">
						<div v-if="global.loggedIn" class="flex flex-col items-center gap-4">
							<GlobalbarButton type="dots-three-vertical" @click="toggleHubOrdering" :class="hubOrdering && '!bg-accent-primary !text-on-accent-primary hover:!bg-accent-secondary'" />
							<GlobalbarButton type="sliders-horizontal" @click="settingsDialog = true" />
							<GlobalbarButton type="sign-out" @click="logout" />
						</div>
					</div>
				</div>
			</div>
		</Modal>
	</div>

	<!-- Dialogs -->
	<SettingsDialog v-if="settingsDialog" @close="settingsDialog = false" />
</template>

<script setup lang="ts">
	// Packages
	import { ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import SettingsDialog from '@global-client/components/forms/SettingsDialog.vue';
	import GlobalbarButton from '@global-client/components/ui/GlobalbarButton.vue';
	import HubMenu from '@global-client/components/ui/HubMenu.vue';
	import Logo from '@global-client/components/ui/Logo.vue';

	// Stores
	import { useGlobal } from '@global-client/stores/global';
	import { useToggleMenu } from '@global-client/stores/toggleGlobalMenu';

	import { useDialog } from '@hub-client/stores/dialog';

	const logoUrl = '/client/img/logo.svg';
	const dialog = useDialog();
	const { t } = useI18n();
	const global = useGlobal();
	const toggleMenu = useToggleMenu();

	const settingsDialog = ref(false);
	const hubOrdering = ref(false);

	const globalClientUrl = _env.PUBHUBS_URL;

	// Make sure that the hubOrdering mode is switched off when a user gets logged out
	watch(
		() => global.loggedIn,
		(newValue: boolean, _) => {
			if (newValue === false) {
				hubOrdering.value = false;
			}
		},
	);

	async function logout() {
		if (await dialog.yesno(t('logout.logout_sure'), '', 'global')) {
			await global.logout();
		}
	}

	async function toggleHubOrdering() {
		if (!global.hubsLoading) {
			hubOrdering.value = !hubOrdering.value;
		}
	}

	function showHelp() {
		dialog.confirm(t('others.help'), t('others.work_in_progress'));
	}
</script>
