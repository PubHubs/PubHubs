<template>
	<div class="border-on-surface-disabled relative flex h-full w-[80px] shrink-0 snap-start flex-col border-r">
		<Modal :show="global.isModalVisible">
			<div class="flex h-full w-full max-w-[100svh] flex-col overflow-y-hidden">
				<div class="border-on-surface-disabled flex aspect-square h-[80px] items-center justify-center border-b p-2">
					<router-link to="/" class="h-full">
						<img alt="PubHubs logo" :src="logoUrl" class="h-full w-full object-contain" />
					</router-link>
				</div>

				<div class="flex h-full flex-1 flex-col gap-1 overflow-y-hidden">
					<HubMenu />

					<div class="flex h-fit w-full flex-col gap-8 self-end p-4">
						<div v-if="global.loggedIn" class="flex flex-col items-center gap-4">
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
	import { ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import SettingsDialog from '@global-client/components/forms/SettingsDialog.vue';
	import GlobalbarButton from '@global-client/components/ui/GlobalbarButton.vue';
	import HubMenu from '@global-client/components/ui/HubMenu.vue';

	// Stores
	import { useGlobal } from '@global-client/stores/global';

	import { useDialog } from '@hub-client/stores/dialog';

	const logoUrl = '/client/img/icons/512x512.svg';
	const dialog = useDialog();
	const { t } = useI18n();
	const global = useGlobal();

	const settingsDialog = ref(false);

	async function logout() {
		if (await dialog.yesno(t('logout.logout_sure'), '', 'global')) {
			await global.logout();
		}
	}
</script>
