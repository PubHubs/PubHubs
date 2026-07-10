<template>
	<div
		ref="barRoot"
		class="border-on-surface-disabled/25 relative flex h-full w-[80px] shrink-0 snap-start flex-col border-r-2"
	>
		<Modal :show="global.isModalVisible">
			<div class="flex h-full w-full max-w-svh flex-col overflow-y-hidden">
				<div class="border-on-surface-disabled/25 flex aspect-square h-[80px] items-center justify-center border-b-2 p-200">
					<router-link
						v-slot="{ isExactActive }"
						class="group focus-visible:ring-accent-blue-interactive flex h-full w-full items-center justify-center rounded transition-all outline-none focus-visible:ring-3"
						:to="{ name: 'home' }"
						:title="t('home.discover_hubs')"
						:aria-label="t('home.discover_hubs')"
					>
						<Icon
							class="text-on-surface/60 transition-color h-600 w-600 duration-200"
							:class="isExactActive ? '' : 'group-hover:text-accent-primary'"
							:data-rail-active="isExactActive || undefined"
							type="compass"
						/>
					</router-link>
				</div>

				<div class="gap-050 flex h-full flex-1 flex-col overflow-y-hidden">
					<HubMenu />

					<div class="flex h-fit w-full flex-col gap-400 self-end p-200">
						<div
							v-if="global.loggedIn"
							class="flex flex-col items-center gap-200"
						>
							<GlobalbarButton
								type="sliders-horizontal"
								:aria-label="t('menu.settings')"
								:title="t('menu.settings')"
								@click="settingsDialog = true"
							/>
							<GlobalbarButton
								type="question-mark"
								:aria-label="t('about.title')"
								:title="t('about.title')"
								@click="aboutDialog = true"
							/>
							<GlobalbarButton
								type="sign-out"
								:aria-label="t('menu.logout')"
								:title="t('menu.logout')"
								@click="logout"
							/>
						</div>
					</div>
				</div>
			</div>
		</Modal>
		<!-- Single active-destination indicator pill, pinned to the bar's left edge and rendered outside
		     the scrollable hub list so it is never clipped. It tracks whichever rail item currently
		     carries `data-rail-active` (the Discover button or the active hub). -->
		<div
			v-show="pill.visible"
			class="bg-accent-primary w-075 pointer-events-none absolute left-0 z-30 -translate-y-1/2 rounded-r-full transition-all duration-200 ease-in-out"
			:style="{ top: `${pill.top}px`, height: `${pill.height}px` }"
		/>
	</div>

	<!-- Dialogs -->
	<SettingsDialog
		v-if="settingsDialog"
		@close="settingsDialog = false"
	/>
	<AboutDialog
		v-if="aboutDialog"
		@close="aboutDialog = false"
	/>
</template>

<script lang="ts" setup>
	// Packages
	import { nextTick, onBeforeUnmount, onMounted, reactive, ref, useTemplateRef, watch } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { useRoute } from 'vue-router';

	// Components
	import SettingsDialog from '@global-client/components/forms/SettingsDialog.vue';
	import AboutDialog from '@global-client/components/ui/AboutDialog.vue';
	import GlobalbarButton from '@global-client/components/ui/GlobalbarButton.vue';
	import HubMenu from '@global-client/components/ui/HubMenu.vue';
	import Modal from '@global-client/components/ui/Modal.vue';

	import Icon from '@hub-client/components/elements/Icon.vue';

	// Stores
	import { useGlobal } from '@global-client/stores/global';
	import { useHubs } from '@global-client/stores/hubs';

	import { useDialog } from '@hub-client/stores/dialog';

	const dialog = useDialog();
	const { t } = useI18n();
	const route = useRoute();
	const global = useGlobal();
	const hubs = useHubs();

	const settingsDialog = ref(false);
	const aboutDialog = ref(false);

	// Single active-destination pill pinned to the bar's left edge. It aligns itself to whichever rail
	// item (the Discover button or the active hub) currently carries `data-rail-active`.
	const barRoot = useTemplateRef<HTMLElement>('barRoot');
	const pill = reactive({ visible: false, top: 0, height: 0 });

	function updatePill() {
		const root = barRoot.value;
		const activeEl = root?.querySelector<HTMLElement>('[data-rail-active]');
		if (!root || !activeEl) {
			pill.visible = false;
			return;
		}
		const rootRect = root.getBoundingClientRect();
		const itemRect = activeEl.getBoundingClientRect();
		pill.height = Math.round(itemRect.height * 0.6);
		pill.top = itemRect.top - rootRect.top + itemRect.height / 2;
		pill.visible = true;
	}

	const scheduleUpdatePill = () => nextTick(updatePill);

	// Re-align when the active destination changes, when hubs load/reorder, or when the layout shifts.
	watch(() => [route.fullPath, hubs.currentHubId, global.hubsLoading, global.pinnedHubs.map((h) => h.hubId).join(',')], scheduleUpdatePill);

	onMounted(() => {
		scheduleUpdatePill();
		window.addEventListener('scroll', updatePill, true);
		window.addEventListener('resize', updatePill);
	});

	onBeforeUnmount(() => {
		window.removeEventListener('scroll', updatePill, true);
		window.removeEventListener('resize', updatePill);
	});

	async function logout() {
		if (await dialog.yesno(t('logout.logout_sure'), '', 'global')) {
			await global.logout();
		}
	}
</script>
