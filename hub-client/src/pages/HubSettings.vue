<template>
	<HeaderFooter>
		<template #header>
			<div
				class="flex h-full items-center gap-3"
				:class="isMobile ? 'pl-4' : 'pl-0'"
			>
				<Icon type="sliders-horizontal" />
				<H3 class="text-on-surface flex">
					<TruncatedText class="font-headings font-semibold">{{ $t('settings.title') }}</TruncatedText>
				</H3>
			</div>
		</template>

		<form
			class="flex flex-col gap-400 px-400 py-200 pb-800"
			@submit.prevent
		>
			<!-- Description -->
			<div class="editor flex max-w-14000 flex-col gap-150">
				<div class="gap-075 flex max-w-7000 flex-col">
					<Label>{{ $t('hub_settings.description_heading') }}</Label>
					<p>{{ $t('hub_settings.description_description') }}</p>
				</div>
				<mavon-editor
					v-model="hubDescription"
					:box-shadow="false"
					language="en"
					:placeholder="t('hub_settings.description')"
					:toolbars="toolbarSettings"
				/>
			</div>

			<!-- Summary -->
			<div class="max-w-7000">
				<TextField
					v-model="hubSummary"
					:placeholder="t('hub_settings.summary')"
					:show-length="true"
					:validation="{ maxLength: maxSummaryLength }"
				>
					{{ t('hub_settings.summary_heading') }}
				</TextField>
			</div>

			<!-- Contact -->
			<div class="editor flex max-w-14000 flex-col gap-150">
				<div class="gap-075 flex max-w-7000 flex-col">
					<Label>{{ $t('hub_settings.contact_heading') }}</Label>
					<p>{{ $t('hub_settings.contact_description') }}</p>
				</div>
				<mavon-editor
					v-model="hubContact"
					:box-shadow="false"
					language="en"
					:placeholder="t('hub_settings.contact')"
					:toolbars="toolbarSettings"
				/>
			</div>

			<!-- Icon -->
			<div class="max-w-7000">
				<MediaUploadSection
					:accept="'image/*, .svg'"
					:description="$t('hub_settings.icon_description')"
					:error-text="iconErrorText"
					:media-url="iconUrl"
					:title="$t('hub_settings.icon_heading')"
					@file-change="onFileChange('icon', $event)"
					@remove="removeMedia('icon')"
				>
					<template #preview>
						<HubIcon
							class="mr-200 w-auto max-w-[70px] rounded-xl border p-200"
							:icon-url="iconUrl"
							:icon-url-dark="iconUrl"
						/>
					</template>
				</MediaUploadSection>
			</div>

			<!-- Banner -->
			<div class="max-w-7000">
				<MediaUploadSection
					:accept="'image/*, .svg'"
					:description="$t('hub_settings.banner_description')"
					:error-text="bannerErrorText"
					:media-url="bannerUrl"
					:title="$t('hub_settings.banner_heading')"
					@file-change="onFileChange('banner', $event)"
					@remove="removeMedia('banner')"
				>
					<template #preview>
						<HubBanner
							:banner-url="bannerUrl"
							class="mr-200 rounded-xl border p-200"
						/>
					</template>
				</MediaUploadSection>
			</div>

			<!-- Consent -->
			<div class="editor flex max-w-14000 flex-col gap-150">
				<div class="gap-075 flex max-w-7000 flex-col">
					<Label>{{ $t('hub_settings.consent_heading') }}</Label>
					<p>{{ $t('hub_settings.consent_description') }}</p>
				</div>
				<mavon-editor
					v-model="hubConsent"
					:box-shadow="false"
					language="en"
					:placeholder="t('hub_settings.consent')"
					:toolbars="toolbarSettings"
				/>
			</div>
		</form>

		<!-- Fixed save button -->
		<div class="fixed right-10 bottom-5 z-20 flex items-center gap-200">
			<p
				v-if="settingsSaved"
				class="text-on-surface-dim text-label-small"
			>
				{{ $t('hub_settings.settings_saved') }}
			</p>
			<Button
				:disabled="!settingsChanged"
				:loading="saving"
				@click="saveChanges()"
				>{{ $t('hub_settings.save') }}</Button
			>
		</div>
	</HeaderFooter>
</template>

<script lang="ts" setup>
	// Packages
	import { computed, onBeforeMount, onBeforeUnmount, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import H3 from '@hub-client/components/elements/H3.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import TruncatedText from '@hub-client/components/elements/TruncatedText.vue';
	import HeaderFooter from '@hub-client/components/ui/HeaderFooter.vue';
	import HubBanner from '@hub-client/components/ui/HubBanner.vue';
	import HubIcon from '@hub-client/components/ui/HubIcon.vue';
	import MediaUploadSection from '@hub-client/components/ui/MediaUploadSection.vue';

	// Logic
	import { BlobManager } from '@hub-client/logic/core/blobManager';
	import { HubSettingsJSONParser } from '@hub-client/logic/json-utility';
	import { createLogger } from '@hub-client/logic/logging/Logger';

	// Stores
	import { ALLOWED_HUB_ICON_TYPES, MAX_HUB_ICON_SIZE, toolbarSettings, useHubSettings } from '@hub-client/stores/hub-settings';
	import { useSettings } from '@hub-client/stores/settings';

	import Button from '@hub-client/new-design/components/Button.vue';
	import Label from '@hub-client/new-design/components/forms/Label.vue';
	import TextField from '@hub-client/new-design/components/forms/TextField.vue';

	const hubSettings = useHubSettings();
	const settings = useSettings();
	const isMobile = computed(() => settings.isMobileState);
	const { t } = useI18n();
	const logger = createLogger('HubSettings');
	const maxSummaryLength = 60;

	// Media files
	const mediaFiles = ref<Record<string, File | null | undefined>>({
		icon: undefined,
		banner: undefined,
	});

	// Error messages
	const iconErrorText = ref<string | undefined>(undefined);
	const bannerErrorText = ref<string | undefined>(undefined);

	// Settings state
	const settingsChanged = ref(false);
	const settingsSaved = ref(false);
	const saving = ref(false);

	// Selected URLs
	const selectedUrls = ref<Record<string, BlobManager | null | undefined>>({
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

	onBeforeUnmount(() => {
		const urls = selectedUrls.value;
		for (const key in urls) {
			urls[key]?.revoke();
		}
	});

	// Computed URLs
	const iconUrl = computed(() => computeMediaUrl('icon'));
	const bannerUrl = computed(() => computeMediaUrl('banner'));

	function computeMediaUrl(mediaType: 'icon' | 'banner'): string {
		const selectedUrl = selectedUrls.value[mediaType];
		if (selectedUrl === undefined) {
			return mediaType === 'icon' ? hubSettings.iconUrlActiveTheme : hubSettings.bannerUrl;
		} else if (selectedUrl === null) {
			return mediaType === 'icon' ? hubSettings.iconDefaultUrlActiveTheme : hubSettings.bannerDefaultUrl;
		} else {
			return selectedUrl?.url ?? '';
		}
	}

	function onFileChange(mediaType: 'icon' | 'banner', file: File) {
		if (!file) return;

		if (!ALLOWED_HUB_ICON_TYPES.includes(file.type)) {
			logger.info('User tried to upload file with type that is not allowed.', { type: file.type });
			showError(mediaType, 'hub_settings.file_format_not_allowed');
			return;
		}

		if (file.size > MAX_HUB_ICON_SIZE) {
			logger.info('User tried to upload file that is too large.', { size: file.size });
			showError(mediaType, 'hub_settings.file_too_large');
			return;
		}

		if (mediaType === 'icon') {
			iconErrorText.value = undefined;
		} else {
			bannerErrorText.value = undefined;
		}

		mediaFiles.value[mediaType] = file;
		selectedUrls.value[mediaType]?.revoke();
		selectedUrls.value[mediaType] = new BlobManager(file);
		settingsChanged.value = true;
	}

	function onHubSettingsChange() {
		const textChanged =
			hubDescription.value !== originalDescription.value ||
			hubSummary.value !== originalSummary.value ||
			hubContact.value !== originalContact.value ||
			hubConsent.value !== originalConsent.value;
		const mediaChanged =
			Object.values(selectedUrls.value).some((url) => url !== undefined) || Object.values(mediaFiles.value).some((file) => file !== undefined);
		settingsChanged.value = textChanged || mediaChanged;
	}

	function removeMedia(mediaType: 'icon' | 'banner') {
		selectedUrls.value[mediaType]?.revoke();
		selectedUrls.value[mediaType] = null;
		mediaFiles.value[mediaType] = null;
		settingsChanged.value = true;
	}

	async function saveChanges() {
		if (!settingsChanged.value) return;
		saving.value = true;

		const iconSaved = await saveMedia('icon');
		const bannerSaved = await saveMedia('banner');
		const hubSettingsSaved = await saveHubSettings();

		settingsSaved.value = iconSaved && bannerSaved && hubSettingsSaved;
		saving.value = false;

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
		if (
			hubDescription.value === originalDescription.value &&
			hubSummary.value === originalSummary.value &&
			hubContact.value === originalContact.value &&
			hubConsent.value === originalConsent.value
		) {
			return true;
		}
		if (hubConsent.value !== originalConsent.value) {
			version.value += 1;
		}
		try {
			await hubSettings.setHubJSON(new HubSettingsJSONParser(hubDescription.value, hubSummary.value, hubContact.value, hubConsent.value, version.value));
			logger.info('Hub settings updated');
			return true;
		} catch (er) {
			logger.error('Failed to save hub description', { error: er });
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

		if (selectedUrl === undefined && !file) return true;

		if (selectedUrl === null) {
			try {
				if (mediaType === 'icon') {
					await hubSettings.deleteIcon();
				} else {
					await hubSettings.deleteBanner();
				}
			} catch (er) {
				logger.error(`Failed to delete ${mediaType}.`, { error: er });
				showError(mediaType, mediaType === 'icon' ? 'hub_settings.error_saving_icon' : 'hub_settings.error_saving_banner');
				return false;
			}
		}

		if (!file) return true;

		logger.info(`Saving new ${mediaType}...`);

		try {
			if (mediaType === 'icon') {
				await hubSettings.setIcon(file);
			} else {
				await hubSettings.setBanner(file);
			}
		} catch {
			showError(mediaType, mediaType === 'icon' ? 'hub_settings.error_saving_icon' : 'hub_settings.error_saving_banner');
			return false;
		}
		return true;
	}

	function showError(mediaType: 'icon' | 'banner', message: string) {
		const translated = t(message).toString();
		if (mediaType === 'icon') {
			iconErrorText.value = translated;
		} else {
			bannerErrorText.value = translated;
		}
	}

	watch([hubDescription, hubSummary, hubContact, hubConsent], onHubSettingsChange);
</script>
