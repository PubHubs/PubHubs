<template>
	<HeaderFooter bgBarLow="bg-background" bgBarMedium="bg-surface-low">
		<template #header>
			<div class="hidden items-center gap-4 md:flex">
				<span class="font-semibold uppercase">{{ $t('rooms.room') }}</span>
				<hr class="h-[2px] grow bg-accent-secondary" />
			</div>
			<div class="relative flex h-full items-center justify-between gap-4" :class="isMobile ? 'pl-12' : 'pl-0'">
				<H3 class="text-on-surface">{{ $t('settings.title') }}</H3>
			</div>
		</template>

		<form @submit.prevent class="flex h-full max-w-screen-2xl flex-col px-4 py-4 md:px-16 md:py-10">
			<div class="mb-4 flex-col">
				<H3 class="pb-2 text-lg font-semibold">{{ $t('hub_settings.icon_heading') }}</H3>
				<p>{{ $t('hub_settings.icon_description') }}</p>
			</div>

			<div class="mb-2 flex h-12 items-center">
				<input ref="elFileInput" type="file" name="logo" class="hidden" @change="onFileChange" />

				<div class="mr-2 h-12 w-12 rounded-xl border p-2">
					<HubIcon :icon-url="iconUrl" :icon-url-dark="iconUrl" />
				</div>

				<div>
					<Icon @click="elFileInput?.click()" type="edit" size="md" :as-button="true" />
					<Icon @click="removeIcon()" type="bin" size="md" :as-button="true" />
				</div>
			</div>
			<p v-if="iconErrorText" class="text-red">{{ iconErrorText }}</p>

			<div class="mt-auto flex items-center">
				<p v-if="settingsSaved" class="text-hub-text-variant">{{ $t('hub_settings.settings_saved') }}</p>
				<Button @click="saveChanges()" :disabled="!settingsChanged" colo>{{ $t('hub_settings.save') }}</Button>
			</div>
		</form>
	</HeaderFooter>
</template>

<script setup lang="ts">
	import Icon from '@/components/elements/Icon.vue';
	import HubIcon from '@/components/ui/HubIcon.vue';
	import HeaderFooter from '@/components/ui/HeaderFooter.vue';
	import { SMI } from '@/logic/foundation/StatusMessage';
	import { LOGGER } from '@/logic/foundation/Logger';
	import { ALLOWED_HUB_ICON_TYPES, MAX_HUB_ICON_SIZE, useHubSettings } from '@/logic/store/hub-settings';
	import { computed, ref, useTemplateRef } from 'vue';
	import { useI18n } from 'vue-i18n';
	import H3 from '@/components/elements/H3.vue';
	import Button from '@/components/elements/Button.vue';
	import { useSettings } from '@/logic/store/settings';

	const hubSettings = useHubSettings();
	const i18n = useI18n();
	const elFileInput = useTemplateRef('elFileInput');
	const newIconFile = ref<File | undefined | null>(undefined);
	const settingsChanged = ref(false);
	const settingsSaved = ref(false);
	const iconErrorText = ref<string | undefined>(undefined);
	const logger = LOGGER;
	const settings = useSettings();
	const isMobile = computed(() => settings.isMobileState);

	const iconUrl = computed(computeIconUrl);
	const selectedIconUrl = ref<string | undefined | null>(undefined);

	function computeIconUrl() {
		if (selectedIconUrl.value === undefined) {
			return hubSettings.iconUrlActiveTheme;
		} else if (selectedIconUrl.value === null) {
			return hubSettings.iconDefaultUrlActiveTheme;
		} else {
			return selectedIconUrl.value;
		}
	}

	function onFileChange() {
		const file = elFileInput.value?.files?.[0];
		if (!file) return;

		if (!ALLOWED_HUB_ICON_TYPES.includes(file.type)) {
			logger.info(SMI.HUB_SETTINGS, 'User tried to upload file with type that is not allowed.', { type: file.type });
			showError('hub_settings.file_format_not_allowed');
			return;
		}

		if (file.size > MAX_HUB_ICON_SIZE) {
			logger.info(SMI.HUB_SETTINGS, 'User tried to upload file that is too large.', { size: file.size });
			showError('hub_settings.file_too_large');
			return;
		}

		iconErrorText.value = undefined;
		newIconFile.value = file;
		selectedIconUrl.value = URL.createObjectURL(file);

		settingsChanged.value = true;
	}

	async function saveChanges() {
		if (!settingsChanged.value) throw new Error('Assertion error');

		settingsSaved.value = await saveIcon();
		settingsChanged.value = !settingsSaved.value;
	}

	async function saveIcon(): Promise<boolean> {
		if (selectedIconUrl.value === null) {
			try {
				await hubSettings.deleteIcon();
			} catch (er) {
				logger.error(SMI.HUB_SETTINGS, 'Failed to delete icon.', { error: er });
				showError('hub_settings.error_saving_icon');
			}
		}

		if (!newIconFile.value) return true;
		logger.info(SMI.HUB_SETTINGS, 'Saving new icon...');

		try {
			await hubSettings.setIcon(newIconFile.value);
		} catch (er) {
			showError('hub_settings.error_saving_icon');
			return false;
		}

		return true;
	}

	function removeIcon() {
		selectedIconUrl.value = null;
		settingsChanged.value = true;
		if (elFileInput.value) {
			elFileInput.value.value = '';
		}
	}

	function showError(message: 'hub_settings.error_saving_icon' | 'hub_settings.file_format_not_allowed' | 'hub_settings.file_too_large') {
		iconErrorText.value = i18n.t(message).toString();
	}
</script>
