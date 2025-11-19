<template>
	<div class="overflow-none flex h-full max-h-screen w-full">
		<!-- Mobile Layout -->
		<div v-if="isMobile" class="flex flex-col">
			<HubBanner :class="'!h-[20svh] shrink-0'" :banner-url="hubSettings.bannerUrl" />

			<div class="relative flex h-full flex-col gap-8 px-4 pt-20">
				<!-- Hub Icon -->
				<div class="bg-surface-low absolute -top-12 h-24 w-24 rounded-2xl p-[3px]">
					<HubIcon :icon-url="hubSettings.iconUrlLight" :icon-url-dark="hubSettings.iconUrlDark" />
				</div>

				<!-- Welcome Message -->
				<div class="flex flex-col gap-2">
					<H1>{{ isConsentOnly ? t('onboarding.welcome_consent') : t('onboarding.welcome', [hubName]) }}</H1>
					<P>{{ isConsentOnly ? t('onboarding.welcome_consent_description') : t('onboarding.welcome_description') }}</P>
				</div>

				<!-- Step 1: Set Username -->
				<div v-if="step == 1" class="flex flex-col justify-between gap-8 pb-4">
					<div class="flex flex-col gap-8">
						<!-- Username Input -->
						<div class="flex flex-col gap-2">
							<H2>{{ t('onboarding.username_label') }}</H2>
							<P>{{ t('onboarding.username_description') }}</P>
							<div class="flex gap-4">
								<TextInput v-model="inputValue" :placeholder="pseudonym" class="!placeholder-on-surface-dim text-label h-10" maxlength="24" />
								<Button @click="fileInput!.click()">
									<Icon type="image-square"></Icon>
								</Button>
								<input ref="fileInput" type="file" accept="image/*" class="hidden" @change="handleFileUpload" />
							</div>
							<p class="text-on-surface-variant italic">
								{{ t('onboarding.username_disclaimer') }}
							</p>
						</div>

						<!-- Preview Message -->
						<div v-if="isUsernameChanged" class="flex flex-col gap-2">
							<P>{{ t('onboarding.message_example') }}</P>
							<div class="bg-surface-low flex w-full items-center gap-6 rounded-xl p-4 xl:w-1/2">
								<div class="flex aspect-square h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full" :class="textColor(color(user.userId!))">
									<img v-if="avatarPreviewUrl" data-testid="avatar" :src="avatarPreviewUrl" class="h-full w-full" />
									<Icon v-else size="lg" type="user" />
								</div>
								<div class="flex flex-col gap-2">
									<div class="flex items-center gap-2">
										<span v-if="inputValue" data-testid="display-name" :class="`${textColor(color(user.userId!))} text-label truncate font-semibold`">
											{{ inputValue }}
										</span>
										<span class="text-label-small">|</span>
										<span class="text-label-small">{{ time }}</span>
									</div>
									<P>{{ t('onboarding.message_example_text') }}</P>
								</div>
							</div>
						</div>
					</div>

					<!-- Next Button -->
					<div class="flex w-full justify-end">
						<Button @click="nextStep" class="w-fit">
							{{ isUsernameChanged ? t('forms.next') : t('forms.skip') }}
						</Button>
					</div>
				</div>

				<!-- Step 2: Consent -->
				<div v-if="step === 2" class="flex flex-col gap-8 pb-4">
					<!-- House Rules -->
					<div class="flex flex-col gap-2 overflow-y-auto">
						<H1>{{ t('onboarding.house_rules', [hubName]) }}</H1>
						<div v-if="consentText" class="bg-surface-low rounded-3xl p-4 break-all">
							<mavon-editor defaultOpen="preview" :toolbarsFlag="false" :subfield="false" v-model="consentText" :boxShadow="false" />
						</div>
					</div>

					<!-- Consent Checkbox -->
					<div class="flex items-center gap-2">
						<Checkbox v-model="hasAgreed" />
						<span>{{ t('onboarding.consent_text') }}</span>
					</div>

					<!-- Buttons -->
					<div class="flex gap-4" :class="isConsentOnly ? 'justify-end' : 'justify-between'">
						<Button v-if="!isConsentOnly" @click="prevStep" color="text" class="text-on-surface-variant w-fit px-0">
							{{ t('forms.back') }}
						</Button>
						<Button :disabled="submitted || !hasAgreed" class="w-fit" @click="submit">
							{{ t('onboarding.enter_hub') }}
						</Button>
					</div>
				</div>
			</div>
		</div>

		<!-- Desktop Layout -->
		<div v-else class="overflow-none relative flex max-h-screen w-full items-center justify-center">
			<div class="relative flex aspect-auto h-auto max-h-full w-3/4 rounded-3xl shadow-sm xl:aspect-[3/2] xl:h-2/3 xl:w-auto">
				<!-- Step 1 -->
				<div v-if="step === 1" class="bg-surface-low flex w-full flex-col overflow-hidden rounded-3xl lg:flex-row">
					<!-- Left Image -->
					<div class="flex h-[250px] w-full flex-col gap-6 overflow-y-auto lg:h-auto lg:w-1/2">
						<figure class="h-full w-full">
							<img alt="Placeholder" src="../assets/onboarding_placeholder.svg" class="h-full w-full object-cover" />
						</figure>
					</div>

					<!-- Right Form -->
					<div class="bg-surface flex h-full w-full flex-col gap-6 overflow-y-auto px-16 py-16 lg:w-1/2 lg:py-32">
						<div class="flex flex-col gap-2">
							<H1>{{ t('onboarding.welcome', [hubName]) }}</H1>
							<P>{{ t('onboarding.welcome_description') }}</P>
						</div>

						<div class="flex flex-col gap-2">
							<H2>{{ t('onboarding.username_label') }}</H2>
							<P>{{ t('onboarding.username_description') }}</P>
							<div class="flex gap-4">
								<TextInput v-model="inputValue" :placeholder="pseudonym" class="!placeholder-on-surface-dim text-label h-10" />
								<Button @click="fileInput!.click()">
									<Icon type="image-square" />
								</Button>
								<input ref="fileInput" type="file" accept="image/*" class="hidden" @change="handleFileUpload" />
							</div>
							<p class="text-on-surface-variant italic">
								{{ t('onboarding.username_disclaimer') }}
							</p>
						</div>

						<!-- Message Preview -->
						<div v-if="isUsernameChanged" class="flex flex-col gap-2">
							<P>{{ t('onboarding.message_example') }}</P>
							<div class="bg-background flex w-full items-center gap-6 rounded-xl p-4">
								<div class="flex aspect-square h-12 w-12 min-w-1/3 shrink-0 items-center justify-center overflow-hidden rounded-full" :class="textColor(color(user.userId!))">
									<img v-if="avatarPreviewUrl" data-testid="avatar" :src="avatarPreviewUrl" class="h-full w-full" />
									<Icon v-else size="lg" type="user" />
								</div>
								<div class="flex flex-col gap-2">
									<div class="flex flex-wrap items-center gap-2">
										<span v-if="inputValue" data-testid="display-name" :class="`${textColor(color(user.userId!))} text-label truncate font-semibold break-all`">
											{{ inputValue }}
										</span>
										<span class="text-label-small">|</span>
										<span class="text-label-small">{{ time }}</span>
									</div>
									<P>{{ t('onboarding.message_example_text') }}</P>
								</div>
							</div>
						</div>

						<Button @click="nextStep" class="w-fit">
							{{ isUsernameChanged ? t('forms.next') : t('forms.skip') }}
						</Button>
					</div>
				</div>

				<!-- Step 2 -->
				<div v-if="step === 2" class="bg-surface-low flex w-full overflow-hidden rounded-3xl">
					<!-- Left Rules -->
					<div class="flex w-1/2 flex-col gap-6 overflow-y-auto px-16 pt-32">
						<H1>{{ t('onboarding.house_rules', [hubName]) }}</H1>
						<div v-if="consentText" class="bg-surface-low rounded-3xl p-4">
							<mavon-editor defaultOpen="preview" :toolbarsFlag="false" :subfield="false" v-model="consentText" :boxShadow="false" />
						</div>
					</div>

					<!-- Right Consent -->
					<div class="bg-surface flex h-full w-1/2 flex-col gap-6 px-16 py-32">
						<Button v-if="!isConsentOnly" @click="prevStep" color="text" class="text-on-surface-variant w-fit px-0">
							{{ t('forms.back') }}
						</Button>
						<div class="flex flex-col gap-2">
							<H1>{{ isConsentOnly ? t('onboarding.welcome_consent') : t('onboarding.welcome', [hubName]) }}</H1>
							<P>{{ isConsentOnly ? t('onboarding.welcome_consent_description') : t('onboarding.welcome_description') }}</P>
						</div>
						<div class="flex items-center gap-4">
							<Checkbox v-model="hasAgreed" />
							<span>{{ t('onboarding.consent_text') }}</span>
						</div>
						<Button :disabled="submitted || !hasAgreed" class="w-fit" @click="submit">
							{{ t('onboarding.enter_hub') }}
						</Button>
					</div>
				</div>

				<!-- Mascot -->
				<figure class="absolute -right-16 -bottom-4 hidden w-64 lg:block xl:-right-32 xl:w-auto">
					<img alt="PubHubs mascotte" src="../assets/mascotte.svg" />
				</figure>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed, onBeforeMount, ref } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { useRoute, useRouter } from 'vue-router';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import H1 from '@hub-client/components/elements/H1.vue';
	import H2 from '@hub-client/components/elements/H2.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import P from '@hub-client/components/elements/P.vue';
	import Checkbox from '@hub-client/components/forms/Checkbox.vue';
	import TextInput from '@hub-client/components/forms/TextInput.vue';
	import HubBanner from '@hub-client/components/ui/HubBanner.vue';
	import HubIcon from '@hub-client/components/ui/HubIcon.vue';

	// Composables
	import { fileUpload } from '@hub-client/composables/fileUpload';
	import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';
	import { useUserColor } from '@hub-client/composables/useUserColor';

	// Stores
	import { useHubSettings } from '@hub-client/stores/hub-settings';
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	const { t } = useI18n();
	const router = useRouter();
	const route = useRoute();
	const pubhubs = usePubhubsStore();
	const user = useUser();
	const hubSettings = useHubSettings();
	const settings = useSettings();
	const hubName = ref(hubSettings.hubName);
	const isMobile = computed(() => settings.isMobileState);
	const inputValue = ref('');
	const pseudonym = ref(user.userId.split(':')[0].substring(1));
	const isUsernameChanged = computed(() => inputValue.value !== '');
	const isConsentOnly = computed(() => route.query.type === 'consent');
	const originalRoute = route.query.originalRoute;
	const step = ref(isConsentOnly.value ? 2 : 1);
	const nextStep = () => (step.value = 2);
	const prevStep = () => (step.value = 1);

	// Avatar handling
	const fileInput = ref<HTMLInputElement | null>(null);
	const avatarMxcUrl = ref<string | null>(null);
	const avatarPreviewUrl = ref<string | null>(null);
	const selectedAvatarFile = ref<File | null>(null);

	const { imageTypes, uploadUrl } = useMatrixFiles();

	const handleFileUpload = (event: Event) => {
		const file = (event.target as HTMLInputElement)?.files?.[0];
		if (file) {
			avatarPreviewUrl.value = URL.createObjectURL(file);
			selectedAvatarFile.value = file;
		}
	};

	const uploadAvatar = async () => {
		const accessToken = pubhubs.Auth.getAccessToken();
		if (!accessToken) return console.error('Access Token is invalid for File upload.');

		const syntheticEvent = {
			currentTarget: {
				files: [selectedAvatarFile.value],
			},
		} as unknown as Event;

		const errorMsg = t('errors.file_upload');

		try {
			fileUpload(errorMsg, accessToken, uploadUrl, imageTypes, syntheticEvent, async (mxUrl) => {
				avatarMxcUrl.value = mxUrl;
				if (avatarMxcUrl.value) {
					await user.setAvatarMxcUrl(avatarMxcUrl.value);
				}
			});
		} catch (error) {
			console.error('Error uploading avatar:', error);
		}
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

	const submit = async () => {
		try {
			if (isConsentOnly.value) {
				await user.setUserConsentVersion(consentVersion.value);
				router.push(typeof originalRoute === 'string' ? originalRoute : '/');
				return;
			}

			if (inputValue.value !== '') {
				await user.setDisplayName(inputValue.value);
			}

			if (selectedAvatarFile.value) {
				await uploadAvatar();
			}

			await user.fetchIfUserNeedsConsent();
			await user.setUserConsentVersion(consentVersion.value);
			router.push(typeof originalRoute === 'string' ? originalRoute : '/');
		} catch (error) {
			console.error('Error during submit:', error);
		}
	};

	// Misc
	const { color, textColor } = useUserColor();

	// TODO: move to a utility folder
	const now = new Date();
	const time = now.toLocaleTimeString([], {
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
	});

	// Lifecycle
	onBeforeMount(() => {
		loadHubSettings();
	});
</script>
