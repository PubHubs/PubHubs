<template>
	<HeaderFooter>
		<template #header>
			<div
				class="flex h-full items-center gap-150"
				:class="isMobile ? 'p-150 pl-700' : 'p-200 pl-400'"
			>
				<Icon type="sliders-horizontal" />
				<H3 class="text-on-surface flex">
					<TruncatedText class="font-headings font-semibold">{{ $t('settings.title') }}</TruncatedText>
				</H3>
			</div>
		</template>

		<ValidatedForm
			ref="formRef"
			v-slot="{ isValidated }"
			class="max-w-7000 gap-400! px-400 py-200 pb-800"
		>
			<!-- Summary -->
			<TextField
				v-model="hubSummary"
				:placeholder="t('hub_settings.summary')"
				:validation="{ required: true }"
			>
				{{ t('hub_settings.summary_heading') }}
			</TextField>

			<!-- Description -->
			<ValidateField
				v-model="hubDescription"
				:validation="{ required: true }"
				name="description"
				:help="$t('hub_settings.description_description')"
			>
				<Label>{{ $t('hub_settings.description_heading') }}</Label>
				<MarkdownEditor
					v-model="hubDescription"
					:placeholder="t('hub_settings.description')"
				/>
			</ValidateField>

			<!-- Contact -->
			<ValidateField
				v-model="hubContact"
				:validation="{ required: true }"
				name="contact"
				:help="$t('hub_settings.contact_description')"
			>
				<Label>{{ $t('hub_settings.contact_heading') }}</Label>
				<MarkdownEditor
					v-model="hubContact"
					:placeholder="t('hub_settings.contact')"
				/>
			</ValidateField>

			<!-- Icon -->
			<MediaUploadField
				v-model="iconFile"
				:accept="'image/png,image/jpeg,image/svg+xml'"
				:description="$t('hub_settings.icon_description')"
				:default-url="hubSettings.iconDefaultUrlActiveTheme"
				:initial-url="hubSettings.iconUrlActiveTheme"
				:max-size="MAX_HUB_ICON_SIZE"
				:save-error="iconSaveError"
				:title="$t('hub_settings.icon_heading')"
				name="icon"
			>
				<template #preview="{ url }">
					<HubIcon
						class="bg-surface-base w-auto max-w-[70px] rounded-xl border p-200"
						:icon-url="url"
						:icon-url-dark="url"
					/>
				</template>
			</MediaUploadField>

			<!-- Banner -->
			<MediaUploadField
				v-model="bannerFile"
				:accept="'image/png,image/jpeg,image/svg+xml'"
				:description="$t('hub_settings.banner_description')"
				:default-url="hubSettings.bannerDefaultUrl"
				:initial-url="hubSettings.bannerUrl"
				:max-size="MAX_HUB_ICON_SIZE"
				:save-error="bannerSaveError"
				:title="$t('hub_settings.banner_heading')"
				name="banner"
			>
				<template #preview="{ url }">
					<HubBanner
						:banner-url="url"
						class="bg-surface-base rounded-xl border p-200"
					/>
				</template>
			</MediaUploadField>

			<!-- Video calls -->
			<ValidateField
				v-model="videocallAdminEnabled"
				:validation="{ required: false }"
				name="videocall"
				:help="videocallToggleDisabled ? videocallDisabledReason : $t('hub_settings.videocall_description')"
			>
				<Label>{{ $t('hub_settings.videocall_heading') }}</Label>
				<Toggle
					v-model="videocallToggleDisplayed"
					:disabled="videocallToggleDisabled"
				>
					{{ videocallToggleDisplayed ? $t('hub_settings.videocall_toggle_on') : $t('hub_settings.videocall_toggle_off') }}
				</Toggle>
			</ValidateField>

			<!-- Consent -->
			<ValidateField
				v-model="hubConsent"
				:validation="{ required: true, minLength: 50 }"
				name="consent"
				:help="$t('hub_settings.consent_description')"
			>
				<Label>{{ $t('hub_settings.consent_heading') }}</Label>
				<MarkdownEditor
					v-model="hubConsent"
					:placeholder="t('hub_settings.consent')"
				/>
			</ValidateField>

			<div class="flex justify-end">
				<Button
					type="submit"
					:disabled="!isValidated"
					@click.stop.prevent="saveChanges()"
					>{{ $t('hub_settings.save') }}</Button
				>

				<p
					v-if="settingsSaved && !isValidated"
					class="text-on-surface-dim text-label-small"
				>
					{{ $t('hub_settings.settings_saved') }}
				</p>
			</div>
		</ValidatedForm>
	</HeaderFooter>
</template>

<script lang="ts" setup>
	// Packages
	import { computed, onBeforeMount, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import H3 from '@hub-client/components/elements/H3.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import TruncatedText from '@hub-client/components/elements/TruncatedText.vue';
	import Label from '@hub-client/components/forms/elements/Label.vue';
	import MarkdownEditor from '@hub-client/components/forms/elements/MarkdownEditor.vue';
	import MediaUploadField from '@hub-client/components/forms/elements/MediaUploadField.vue';
	import TextField from '@hub-client/components/forms/elements/TextField.vue';
	import Toggle from '@hub-client/components/forms/elements/Toggle.vue';
	import ValidateField from '@hub-client/components/forms/elements/ValidateField.vue';
	import ValidatedForm from '@hub-client/components/forms/elements/ValidatedForm.vue';
	import HeaderFooter from '@hub-client/components/ui/HeaderFooter.vue';
	import HubBanner from '@hub-client/components/ui/HubBanner.vue';
	import HubIcon from '@hub-client/components/ui/HubIcon.vue';

	// Logic
	import { HubSettingsJSONParser } from '@hub-client/logic/json-utility';
	import { createLogger } from '@hub-client/logic/logging/Logger';

	// Stores
	import { MAX_HUB_ICON_SIZE, useHubSettings } from '@hub-client/stores/hub-settings';
	import { FeatureFlag, useSettings } from '@hub-client/stores/settings';

	const hubSettings = useHubSettings();
	const settings = useSettings();
	const isMobile = computed(() => settings.isMobileState);
	const { t } = useI18n();
	const logger = createLogger('HubSettings');
	const formRef = ref();

	// Media files
	const iconFile = ref<File | null>();
	const bannerFile = ref<File | null>();
	const iconSaveError = ref<string | undefined>(undefined);
	const bannerSaveError = ref<string | undefined>(undefined);

	// Settings state
	const settingsSaved = ref(false);
	const saving = ref(false);

	// Hub settings
	const hubDescription = ref<string>(hubSettings.hubDescription);
	const originalDescription = ref<string>(hubSettings.hubDescription);

	const hubSummary = ref<string>(hubSettings.hubSummary);
	const originalSummary = ref<string>(hubSettings.hubSummary);

	const hubContact = ref<string>(hubSettings.hubContact);
	const originalContact = ref<string>(hubSettings.hubContact);

	const hubConsent = ref<string>(hubSettings.hubConsent);
	const originalConsent = ref<string>(hubSettings.hubConsent);

	const videocallAdminEnabled = ref<boolean>(hubSettings.videocallAdminEnabled);
	const originalVideocallAdminEnabled = ref<boolean>(hubSettings.videocallAdminEnabled);

	// The toggle is interactive only when the feature flag is on AND the hub has LiveKit configured.
	const videocallFeatureEnabled = computed(() => settings.isFeatureEnabled(FeatureFlag.videocalls));
	const videocallToggleDisabled = computed(() => !videocallFeatureEnabled.value || !hubSettings.videocallEnabled);
	const videocallDisabledReason = computed(() =>
		videocallFeatureEnabled.value ? t('hub_settings.videocall_disabled_reason') : t('hub_settings.videocall_feature_disabled_reason'),
	);

	// Shows the toggle as "off" while it is disabled, without touching the saved admin preference,
	// so that preference applies again once LiveKit is configured.
	const videocallToggleDisplayed = computed<boolean>({
		get: () => (videocallToggleDisabled.value ? false : videocallAdminEnabled.value),
		set: (val) => {
			videocallAdminEnabled.value = val;
		},
	});

	const version = ref<number>(0);

	onBeforeMount(() => {
		displayHubJSON();
	});

	async function saveChanges() {
		saving.value = true;

		const iconSaved = await saveMedia('icon');
		const bannerSaved = await saveMedia('banner');
		const hubSettingsSaved = await saveHubSettings();

		settingsSaved.value = iconSaved && bannerSaved && hubSettingsSaved;
		saving.value = false;

		if (settingsSaved.value) {
			formRef.value?.resetForm();
			iconFile.value = undefined;
			bannerFile.value = undefined;
			iconSaveError.value = undefined;
			bannerSaveError.value = undefined;
			originalDescription.value = hubDescription.value;
			originalSummary.value = hubSummary.value;
			originalContact.value = hubContact.value;
			originalConsent.value = hubConsent.value;
			originalVideocallAdminEnabled.value = videocallAdminEnabled.value;
		}
	}

	async function saveHubSettings(): Promise<boolean> {
		if (
			hubDescription.value === originalDescription.value &&
			hubSummary.value === originalSummary.value &&
			hubContact.value === originalContact.value &&
			hubConsent.value === originalConsent.value &&
			videocallAdminEnabled.value === originalVideocallAdminEnabled.value
		) {
			return true;
		}
		if (hubConsent.value !== originalConsent.value) {
			version.value += 1;
		}
		try {
			await hubSettings.setHubJSON(
				new HubSettingsJSONParser(
					hubDescription.value,
					hubSummary.value,
					hubContact.value,
					hubConsent.value,
					version.value,
					videocallAdminEnabled.value,
				),
			);
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
			videocallAdminEnabled.value = hubSettingsJSON.videocall_admin_enabled === true;
			originalVideocallAdminEnabled.value = videocallAdminEnabled.value;
			version.value = hubSettingsJSON.version;
		}
	}

	async function saveMedia(mediaType: 'icon' | 'banner'): Promise<boolean> {
		const file = mediaType === 'icon' ? iconFile.value : bannerFile.value;

		if (file === undefined) return true;

		if (file === null) {
			try {
				if (mediaType === 'icon') {
					await hubSettings.deleteIcon();
				} else {
					await hubSettings.deleteBanner();
				}
			} catch (er) {
				logger.error(`Failed to delete ${mediaType}.`, { error: er });
				const fallbackKey = mediaType === 'icon' ? 'hub_settings.error_saving_icon' : 'hub_settings.error_saving_banner';
				const message = er instanceof Error ? er.message : t(fallbackKey).toString();
				if (mediaType === 'icon') iconSaveError.value = message;
				else bannerSaveError.value = message;
				return false;
			}
			return true;
		}

		logger.info(`Saving new ${mediaType}...`);

		try {
			if (mediaType === 'icon') {
				await hubSettings.setIcon(file);
			} else {
				await hubSettings.setBanner(file);
			}
		} catch (er) {
			const fallbackKey = mediaType === 'icon' ? 'hub_settings.error_saving_icon' : 'hub_settings.error_saving_banner';
			const message = er instanceof Error ? er.message : t(fallbackKey).toString();
			logger.error(`Failed to save ${mediaType}.`, { error: er });
			if (mediaType === 'icon') iconSaveError.value = message;
			else bannerSaveError.value = message;
			return false;
		}
		return true;
	}
</script>
