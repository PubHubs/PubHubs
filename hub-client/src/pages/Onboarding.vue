<template>
	<div class="flex h-screen max-h-screen w-full overflow-hidden">
		<!-- Mobile Layout -->
		<div
			v-if="isMobile"
			class="bg-surface flex h-full w-full flex-col overflow-hidden"
		>
			<!-- Content: scrolls as a whole, so the banner makes way for the form (also with the keyboard open) -->
			<div
				ref="mobileContent"
				class="min-h-0 flex-1 overflow-y-auto"
			>
				<HubBanner
					:banner-url="hubSettings.bannerUrl"
					:class="'h-[20svh]! shrink-0'"
				/>

				<div class="relative flex flex-col gap-400 px-200 pt-800 pb-400">
					<!-- Hub Icon -->
					<div class="bg-surface-base p-050 absolute -top-500 h-1000 w-1000 rounded-2xl">
						<HubIcon
							:icon-url="hubSettings.iconUrlLight"
							:icon-url-dark="hubSettings.iconUrlDark"
						/>
					</div>

					<!-- Step 1: Set Username -->
					<template v-if="step === 1">
						<div class="flex flex-col gap-100">
							<p class="text-label-small text-on-surface-dim">{{ t('onboarding.step', [1, 2]) }}</p>
							<H1>{{ t('onboarding.welcome', [hubName]) }}</H1>
							<P>{{ t('onboarding.welcome_description') }}</P>
						</div>
						<OnboardingProfileForm
							v-model="inputValue"
							v-model:avatar-file="selectedAvatarFile"
							:pseudonym="pseudonym"
							@submit="nextStep"
						/>
					</template>

					<!-- Step 2: House Rules -->
					<template v-if="step === 2">
						<div class="flex flex-col gap-100">
							<p
								v-if="!isConsentOnly"
								class="text-label-small text-on-surface-dim"
							>
								{{ t('onboarding.step', [2, 2]) }}
							</p>
							<H1>{{ isConsentOnly ? t('onboarding.welcome_consent') : t('onboarding.house_rules', [hubName]) }}</H1>
							<P v-if="isConsentOnly">{{ t('onboarding.welcome_consent_description') }}</P>
						</div>
						<MarkdownPreview
							v-if="consentText"
							:content="consentText"
						/>
					</template>
				</div>
			</div>

			<!-- Actions: stay at the bottom, within thumb reach -->
			<div class="border-surface-elevated flex shrink-0 flex-col gap-200 border-t p-200">
				<!-- Consent Checkbox -->
				<Checkbox
					v-if="step === 2"
					v-model="hasAgreed"
					class="items-start!"
				>
					{{ t('onboarding.consent_text', [hubName]) }}
				</Checkbox>

				<p
					v-if="submitError"
					class="text-accent-error"
					role="alert"
				>
					{{ t('onboarding.submit_error') }}
				</p>

				<!-- Buttons -->
				<div class="flex gap-200">
					<Button
						v-if="step === 1"
						class="max-w-none! flex-1"
						:disabled="!isNameValid"
						@click="nextStep"
					>
						{{ hasProfileChanges ? t('forms.next') : t('forms.skip') }}
					</Button>
					<template v-else>
						<Button
							v-if="!isConsentOnly"
							class="text-on-surface w-fit px-0"
							variant="tertiary"
							@click="prevStep"
						>
							{{ t('forms.back') }}
						</Button>
						<Button
							class="max-w-none! flex-1"
							:disabled="!hasAgreed"
							:loading="submitted"
							@click="submit"
						>
							{{ t('onboarding.enter_hub') }}
						</Button>
					</template>
				</div>
			</div>
		</div>

		<!-- Desktop Layout -->
		<div
			v-else
			class="relative flex h-full w-full items-center justify-center"
		>
			<div class="relative flex aspect-auto h-auto max-h-[90%] w-3/4 rounded-3xl shadow-sm xl:aspect-3/2 xl:h-2/3 xl:w-auto">
				<!-- Step 1 -->
				<div
					v-if="step === 1"
					class="bg-surface-base flex w-full flex-col overflow-hidden rounded-3xl lg:flex-row"
				>
					<!-- Left Image -->
					<div class="flex h-[250px] w-full flex-col gap-300 overflow-y-auto lg:h-auto lg:w-1/2">
						<figure class="h-full w-full">
							<img
								alt="Placeholder"
								class="h-full w-full object-cover"
								src="../assets/onboarding_placeholder.svg"
							/>
						</figure>
					</div>

					<!-- Right Form -->
					<div class="bg-surface flex h-full w-full flex-col gap-300 overflow-y-auto px-800 py-800 lg:w-1/2 lg:py-2000">
						<div class="flex flex-col gap-100">
							<H1>{{ t('onboarding.welcome', [hubName]) }}</H1>
							<P>{{ t('onboarding.welcome_description') }}</P>
						</div>

						<OnboardingProfileForm
							v-model="inputValue"
							v-model:avatar-file="selectedAvatarFile"
							:pseudonym="pseudonym"
							@submit="nextStep"
						/>

						<Button
							class="w-fit"
							:disabled="!isNameValid"
							@click="nextStep"
						>
							{{ hasProfileChanges ? t('forms.next') : t('forms.skip') }}
						</Button>
					</div>
				</div>

				<!-- Step 2 -->
				<div
					v-if="step === 2"
					class="bg-surface flex w-full overflow-hidden rounded-3xl"
				>
					<!-- Left Rules -->
					<div class="flex h-full w-1/2 flex-col gap-300 overflow-y-auto px-800 pt-2000">
						<H1>{{ t('onboarding.house_rules', [hubName]) }}</H1>
						<MarkdownPreview
							v-if="consentText"
							:content="consentText"
							class="bg-surface rounded-3xl p-200"
						/>
					</div>

					<!-- Right Consent -->
					<div class="bg-surface flex h-full w-1/2 flex-col gap-300 overflow-y-auto px-800 py-2000">
						<Button
							v-if="!isConsentOnly"
							class="text-on-surface w-fit px-0"
							variant="tertiary"
							@click="prevStep"
						>
							{{ t('forms.back') }}
						</Button>
						<div class="flex flex-col gap-100">
							<H1>{{ isConsentOnly ? t('onboarding.welcome_consent') : t('onboarding.welcome', [hubName]) }}</H1>
							<P>{{ isConsentOnly ? t('onboarding.welcome_consent_description') : t('onboarding.welcome_description') }}</P>
						</div>
						<Checkbox
							v-model="hasAgreed"
							class="items-start!"
						>
							{{ t('onboarding.consent_text', [hubName]) }}
						</Checkbox>
						<p
							v-if="submitError"
							class="text-accent-error"
							role="alert"
						>
							{{ t('onboarding.submit_error') }}
						</p>
						<Button
							class="w-fit"
							:disabled="!hasAgreed"
							:loading="submitted"
							@click="submit"
						>
							{{ t('onboarding.enter_hub') }}
						</Button>
					</div>
				</div>

				<!-- Mascot -->
				<figure class="absolute -right-800 -bottom-600 hidden w-3000 md:w-2500 lg:block xl:-right-1200 xl:w-auto">
					<img
						alt="PubHubs mascotte"
						src="../assets/mascotte.svg"
					/>
				</figure>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { computed, onBeforeMount, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { useRoute, useRouter } from 'vue-router';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import H1 from '@hub-client/components/elements/H1.vue';
	import P from '@hub-client/components/elements/P.vue';
	import OnboardingProfileForm from '@hub-client/components/forms/OnboardingProfileForm.vue';
	import Checkbox from '@hub-client/components/forms/elements/Checkbox.vue';
	import MarkdownPreview from '@hub-client/components/forms/elements/MarkdownPreview.vue';
	import HubBanner from '@hub-client/components/ui/HubBanner.vue';
	import HubIcon from '@hub-client/components/ui/HubIcon.vue';

	// Composables
	import { avatarUpload } from '@hub-client/composables/fileUpload';

	// Logic
	import { createLogger } from '@hub-client/logic/logging/Logger';

	// Stores
	import { useHubSettings } from '@hub-client/stores/hub-settings';
	import { useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	const logger = createLogger('Onboarding');
	const { t } = useI18n();
	const router = useRouter();
	const route = useRoute();
	const user = useUser();
	const hubSettings = useHubSettings();
	const settings = useSettings();
	const hubName = ref(hubSettings.hubName);
	const isMobile = computed(() => settings.isMobileState);
	const inputValue = ref('');
	const displayName = computed(() => inputValue.value.trim());
	// Empty is allowed: it keeps the pseudonym
	const isNameValid = computed(
		() => displayName.value === '' || (displayName.value.length >= 3 && displayName.value.length <= settings.getDisplayNameMaxLength),
	);
	const pseudonym = ref(user.userId?.split(':')[0].substring(1));
	const isConsentOnly = computed(() => route.query.type === 'consent');
	const originalRoute = route.query.originalRoute;
	const step = ref(isConsentOnly.value ? 2 : 1);
	const nextStep = () => {
		if (isNameValid.value) step.value = 2;
	};
	const prevStep = () => (step.value = 1);

	// Both steps share one scroll container on mobile, so start each step at its top
	const mobileContent = ref<HTMLElement | null>(null);
	watch(step, () => {
		if (mobileContent.value) mobileContent.value.scrollTop = 0;
	});

	// Avatar handling
	const avatarMxcUrl = ref<string | null>(null);
	const selectedAvatarFile = ref<File | null>(null);
	const hasProfileChanges = computed(() => displayName.value !== '' || selectedAvatarFile.value !== null);

	const uploadAvatar = async () => {
		if (!selectedAvatarFile.value) return;

		await avatarUpload(
			selectedAvatarFile.value,
			async (mxUrl) => {
				if (mxUrl) {
					avatarMxcUrl.value = mxUrl;
					user.setAvatarUrl(avatarMxcUrl.value);
				}
			},
			() => {
				selectedAvatarFile.value = null;
				logger.error('Error uploading avatar');
			},
		);
	};

	// Consent handling
	const hasAgreed = ref(false);
	const consentVersion = ref(hubSettings.hubConsentVersion);
	const consentText = ref('');

	const loadHubSettings = async () => {
		const hubSettingsJSON = await hubSettings.getHubJSON();

		if (hubSettingsJSON) {
			consentVersion.value = hubSettingsJSON.version ? hubSettingsJSON.version : hubSettings.hubConsentVersion;
			consentText.value = hubSettingsJSON.consent;
		}
	};

	// Submit
	const submitted = ref(false);
	const submitError = ref(false);

	const submit = async () => {
		submitted.value = true;
		submitError.value = false;
		try {
			if (isConsentOnly.value) {
				await user.setUserConsentVersion(consentVersion.value);
				router.push(typeof originalRoute === 'string' ? originalRoute : '/');
				return;
			}

			// Already validated before leaving step 1
			if (displayName.value !== '') {
				await user.setDisplayName(displayName.value);
			}

			if (selectedAvatarFile.value) {
				await uploadAvatar();
			}

			await user.fetchIfUserNeedsConsent();
			await user.setUserConsentVersion(consentVersion.value);
			router.push(typeof originalRoute === 'string' ? originalRoute : '/');
		} catch (error) {
			logger.error('Error during submit:', error);
			submitted.value = false;
			submitError.value = true;
		}
	};

	// Lifecycle
	onBeforeMount(() => {
		loadHubSettings();
	});
</script>
