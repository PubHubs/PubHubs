<template>
	<HeaderFooter bgBarLow="bg-background" bgBarMedium="bg-surface-low">
		<template #header>
			<div class="hidden items-center gap-4 md:flex">
				<span class="font-semibold uppercase">{{ $t('rooms.room') }}</span>
				<hr class="bg-accent-secondary h-[2px] grow" />
			</div>
			<div class="relative flex h-full items-center justify-between gap-4" :class="isMobile ? 'pl-12' : 'pl-0'">
				<H3 class="text-on-surface">{{ $t('settings.title') }}</H3>
			</div>
		</template>

		<form @submit.prevent class="flex h-full max-w-screen-2xl flex-col px-4 py-4 md:px-16 md:py-10">
			<!-- Description Section -->
			<div class="editor mb-8 flex flex-col gap-y-2">
				<H3>{{ $t('hub_settings.description_heading') }}</H3>
				<P>{{ $t('hub_settings.description_description') }}</P>
				<mavon-editor v-model="hubDescription" language="en" :toolbars="toolbarSettings" :boxShadow="false" :placeholder="t('hub_settings.description')" />
			</div>

			<!-- Summary Section -->
			<div class="editor mb-2 flex flex-col gap-y-2">
				<H3>{{ $t('hub_settings.summary_heading') }}</H3>
				<P>{{ $t('hub_settings.summary_description') }}</P>
				<TextArea v-model="hubSummary" class="border-hub-border max-h-16 w-full rounded-md border p-3" rows="4" :placeholder="t('hub_settings.summary')" :maxlength="maxSummaryLength"></TextArea>
				<P class="text-label-small float-end"> {{ hubSummary.length }} / {{ maxSummaryLength }} </P>
			</div>

			<!-- Contact Section -->
			<div class="editor mb-8 flex flex-col gap-y-2">
				<H3>{{ $t('hub_settings.contact_heading') }}</H3>
				<P>{{ $t('hub_settings.contact_description') }}</P>
				<mavon-editor v-model="hubContact" language="en" :toolbars="toolbarSettings" :boxShadow="false" :placeholder="t('hub_settings.contact')" />
			</div>

			<!-- Icon Section -->
			<MediaUploadSection
				:title="$t('hub_settings.icon_heading')"
				:description="$t('hub_settings.icon_description')"
				:media-url="iconUrl"
				:accept="'image/*, .svg'"
				:error-text="iconErrorText"
				@file-change="onFileChange('icon', $event)"
				@remove="removeMedia('icon')"
			>
				<template #preview class="w-fit">
					<HubIcon :icon-url="iconUrl" :icon-url-dark="iconUrl" class="mr-2 w-auto max-w-[70px] rounded-xl border p-2" />
				</template>
			</MediaUploadSection>

			<!-- Banner Section -->
			<MediaUploadSection
				:title="$t('hub_settings.banner_heading')"
				:description="$t('hub_settings.banner_description')"
				:media-url="bannerUrl"
				:accept="'image/*, .svg'"
				:error-text="bannerErrorText"
				@file-change="onFileChange('banner', $event)"
				@remove="removeMedia('banner')"
			>
				<template #preview>
					<HubBanner :banner-url="bannerUrl" class="mr-2 rounded-xl border p-2" />
				</template>
			</MediaUploadSection>

			<!-- Consent Section -->
			<div class="mb-8">
				<div class="editor mb-32 flex flex-col gap-y-2">
					<H3 class="pb-2 text-lg font-semibold">{{ $t('hub_settings.consent_heading') }}</H3>
					<P>{{ $t('hub_settings.consent_description') }}</P>
					<mavon-editor v-model="hubConsent" language="en" :toolbars="toolbarSettings" :boxShadow="false" :placeholder="t('hub_settings.consent')" />
				</div>
			</div>
			<div class="fixed right-10 bottom-5 z-20 ml-auto flex items-center">
				<P v-if="settingsSaved" class="text-hub-text-variant">{{ $t('hub_settings.settings_saved') }}</P>
				<Button @click="saveChanges()" :disabled="!settingsChanged">{{ $t('hub_settings.save') }}</Button>
			</div>
		</form>
	</HeaderFooter>
</template>

<script setup lang="ts">
	// Packages
	import { computed, onBeforeMount, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Assets
	import '@hub-client/assets/tailwind.css';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import H3 from '@hub-client/components/elements/H3.vue';
	import P from '@hub-client/components/elements/P.vue';
	import TextArea from '@hub-client/components/forms/TextArea.vue';
	import HeaderFooter from '@hub-client/components/ui/HeaderFooter.vue';
	import HubBanner from '@hub-client/components/ui/HubBanner.vue';
	import HubIcon from '@hub-client/components/ui/HubIcon.vue';
	import MediaUploadSection from '@hub-client/components/ui/MediaUploadSection.vue';

	// Logic
	import { HubSettingsJSONParser } from '@hub-client/logic/json-utility';
	import { LOGGER } from '@hub-client/logic/logging/Logger';
	import { SMI } from '@hub-client/logic/logging/StatusMessage';

	// Stores
	import { ALLOWED_HUB_ICON_TYPES, MAX_HUB_ICON_SIZE, toolbarSettings, useHubSettings } from '@hub-client/stores/hub-settings';
	import { useSettings } from '@hub-client/stores/settings';

	const hubSettings = useHubSettings();
	const { t } = useI18n();
	const logger = LOGGER;
	const maxSummaryLength = 60;

	// Media files
	const mediaFiles = ref<Record<string, File | null | undefined>>({
		icon: undefined,
		banner: undefined,
	});

	// Error messages
	const iconErrorText = ref<string | undefined>(undefined);
	const bannerErrorText = ref<string | undefined>(undefined);

	const settings = useSettings();
	const isMobile = computed(() => settings.isMobileState);

	// Settings state
	const settingsChanged = ref(false);
	const settingsSaved = ref(false);

	// Selected URLs
	const selectedUrls = ref<Record<string, string | null | undefined>>({
		icon: undefined,
		banner: undefined,
	});

	// Hub settings
	const hubDescription = ref<string>(hubSettings.hubDescription);
	const originalDescription = ref<string>(hubSettings.hubDescription);

	const hubSummary = ref<string>(hubSettings.hubSummary);
	const originalSummary = ref<string>(hubSettings.hubSummary);

	const hubContact = ref<string>(hubSettings.hubContact);
	const originalContact = ref<string>(hubSettings.hubContact);

	const hubConsent = ref<string>(hubSettings.hubConsent);
	const originalConsent = ref<string>(hubSettings.hubConsent);

	const version = ref<number>(0);

	onBeforeMount(() => {
		displayHubJSON();
	});

	// Computed URLs
	const iconUrl = computed(() => computeMediaUrl('icon'));
	const bannerUrl = computed(() => computeMediaUrl('banner'));

	function computeMediaUrl(mediaType: 'icon' | 'banner') {
		const selectedUrl = selectedUrls.value[mediaType];

		if (selectedUrl === undefined) {
			return mediaType === 'icon' ? hubSettings.iconUrlActiveTheme : hubSettings.bannerUrl;
		} else if (selectedUrl === null) {
			return mediaType === 'icon' ? hubSettings.iconDefaultUrlActiveTheme : hubSettings.bannerDefaultUrl;
		} else {
			return selectedUrl;
		}
	}

	function onFileChange(mediaType: 'icon' | 'banner', file: File) {
		if (!file) return;

		if (!ALLOWED_HUB_ICON_TYPES.includes(file.type)) {
			logger.info(SMI.HUB_SETTINGS, 'User tried to upload file with type that is not allowed.', { type: file.type });
			showError(mediaType, 'hub_settings.file_format_not_allowed');
			return;
		}

		if (file.size > MAX_HUB_ICON_SIZE) {
			logger.info(SMI.HUB_SETTINGS, 'User tried to upload file that is too large.', { size: file.size });
			showError(mediaType, 'hub_settings.file_too_large');
			return;
		}

		// Clear any previous error
		if (mediaType === 'icon') {
			iconErrorText.value = undefined;
		} else {
			bannerErrorText.value = undefined;
		}

		// Store the file and create object URL
		mediaFiles.value[mediaType] = file;
		selectedUrls.value[mediaType] = URL.createObjectURL(file);
		settingsChanged.value = true;
	}

	function onHubSettingsChange() {
		// Mark settings as changed if hubsettings are different from original
		if (hubDescription.value !== originalDescription.value || hubSummary.value !== originalSummary.value || hubContact.value !== originalContact.value || hubConsent.value !== originalConsent.value) {
			settingsChanged.value = true;
		} else if (selectedUrls.value !== undefined || mediaFiles.value !== undefined) {
			settingsChanged.value = false;
		} else if (!Object.values(selectedUrls.value).some((url) => url !== undefined) && !Object.values(mediaFiles.value).some((file) => file !== undefined)) {
			// If nothing else has changed and hubsettings reverted to original
			settingsChanged.value = false;
		}
	}

	function removeMedia(mediaType: 'icon' | 'banner') {
		selectedUrls.value[mediaType] = null;
		mediaFiles.value[mediaType] = null;
		settingsChanged.value = true;
	}

	async function saveChanges() {
		if (!settingsChanged.value) throw new Error('Assertion error');

		const iconSaved = await saveMedia('icon');
		const bannerSaved = await saveMedia('banner');
		const hubSettingsSaved = await saveHubSettings();

		settingsSaved.value = iconSaved && bannerSaved && hubSettingsSaved;

		if (settingsSaved.value) {
			settingsChanged.value = false;
			originalDescription.value = hubDescription.value;
			originalSummary.value = hubSummary.value;
			originalContact.value = hubContact.value;
			originalConsent.value = hubConsent.value;
		}
	}

	async function saveHubSettings(): Promise<boolean> {
		// Skip if hubsettings have not changed
		if (hubDescription.value === originalDescription.value && hubSummary.value === originalSummary.value && hubContact.value === originalContact.value && hubConsent.value === originalConsent.value) {
			return true;
		}
		if (hubConsent.value !== originalConsent.value) {
			version.value += 1;
		}

		try {
			await hubSettings.setHubJSON(new HubSettingsJSONParser(hubDescription.value, hubSummary.value, hubContact.value, hubConsent.value, version.value));
			logger.info(SMI.HUB_SETTINGS, 'Hub settings updated');
			return true;
		} catch (er) {
			logger.error(SMI.HUB_SETTINGS, 'Failed to save hub description', { error: er });
			return false;
		}
	}
	async function displayHubJSON(): Promise<void> {
		const hubSettingsJSON = await hubSettings.getHubJSON();
		if (hubSettingsJSON) {
			hubDescription.value = hubSettingsJSON.description;
			originalDescription.value = hubDescription.value;
			hubSummary.value = hubSettingsJSON.summary;
			originalSummary.value = hubSummary.value;
			hubContact.value = hubSettingsJSON.contact;
			originalContact.value = hubContact.value;
			hubConsent.value = hubSettingsJSON.consent;
			originalConsent.value = hubConsent.value;
			version.value = hubSettingsJSON.version;
		}
	}

	async function saveMedia(mediaType: 'icon' | 'banner'): Promise<boolean> {
		const selectedUrl = selectedUrls.value[mediaType];
		const file = mediaFiles.value[mediaType];

		// Skip if nothing changed for this media type
		if (selectedUrl === undefined && !file) {
			return true;
		}

		// Handle deletion
		if (selectedUrl === null) {
			try {
				if (mediaType === 'icon') {
					await hubSettings.deleteIcon();
				} else {
					await hubSettings.deleteBanner();
				}
			} catch (er) {
				logger.error(SMI.HUB_SETTINGS, `Failed to delete ${mediaType}.`, { error: er });
				showError(mediaType, mediaType === 'icon' ? 'hub_settings.error_saving_icon' : 'hub_settings.error_saving_banner');
				return false;
			}
		}

		// No new file to upload
		if (!file) return true;

		logger.info(SMI.HUB_SETTINGS, `Saving new ${mediaType}...`);

		try {
			if (mediaType === 'icon') {
				await hubSettings.setIcon(file);
			} else {
				await hubSettings.setBanner(file);
			}
		} catch (er) {
			showError(mediaType, mediaType === 'icon' ? 'hub_settings.error_saving_icon' : 'hub_settings.error_saving_banner');
			return false;
		}

		return true;
	}

	function showError(mediaType: 'icon' | 'banner', message: 'hub_settings.error_saving_icon' | 'hub_settings.error_saving_banner' | 'hub_settings.file_format_not_allowed' | 'hub_settings.file_too_large') {
		if (mediaType === 'icon') {
			iconErrorText.value = t(message).toString();
		} else {
			bannerErrorText.value = t(message).toString();
		}
	}
	watch([hubDescription, hubSummary, hubContact, hubConsent], () => {
		onHubSettingsChange();
	});
</script>
