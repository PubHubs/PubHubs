<template>
	<div class="overflow-none flex h-full max-h-screen w-full">
		<!-- Mobile Layout -->
		<div v-if="isMobile" class="flex flex-col">
			<HubBanner :class="'!h-[20svh] shrink-0'" :banner-url="hubSettings.bannerUrl" />

			<div class="relative flex h-full flex-col gap-8 px-4 pt-20">
				<!-- Hub Icon -->
				<div class="absolute -top-12 h-24 w-24 rounded-2xl bg-surface-low p-[3px]">
					<HubIcon :icon-url="hubSettings.iconUrlLight" :icon-url-dark="hubSettings.iconUrlDark" />
				</div>

				<!-- Welcome Message -->
				<div class="flex flex-col gap-2">
					<H1>{{ isConsentOnly ? t('onboarding.welcome_consent') : t('onboarding.welcome', [hubName]) }}</H1>
					<P>{{ isConsentOnly ? t('onboarding.welcome_consent_description') : t('onboarding.welcome_description') }}</P>
				</div>

				<!-- Step 1: Set Username -->
				<div v-if="step == 1" class="flex h-full flex-col justify-between gap-8 pb-4">
					<div class="flex flex-col gap-8">
						<!-- Username Input -->
						<div class="flex flex-col gap-2">
							<H2>{{ t('onboarding.username_label') }}</H2>
							<P>{{ t('onboarding.username_description') }}</P>
							<div class="flex gap-4">
								<TextInput v-model="inputValue" :placeholder="pseudonym" class="h-10 !placeholder-on-surface-dim ~text-label-min/label-max" />
								<Button @click="fileInput!.click()">
									<Icon type="image_add" :filled="true" />
								</Button>
								<input ref="fileInput" type="file" accept="image/*" class="hidden" @change="handleFileUpload" />
							</div>
							<p class="italic text-on-surface-variant">
								{{ t('onboarding.username_disclaimer') }}
							</p>
						</div>

						<!-- Preview Message -->
						<div v-if="isUsernameChanged" class="flex flex-col gap-2">
							<P>{{ t('onboarding.message_example') }}</P>
							<div class="w--full flex items-center rounded-xl bg-surface-low ~gap-4/8 ~p-3/6 xl:w-1/2">
								<div class="flex aspect-square h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full" :class="textColor(color(user.userId!))">
									<img v-if="avatarPreviewUrl" data-testid="avatar" :src="avatarPreviewUrl" class="h-full w-full" />
									<Icon v-else size="lg" type="person" />
								</div>
								<div class="flex flex-col ~gap-1/2">
									<div class="flex items-center ~gap-1/2">
										<span v-if="inputValue" data-testid="display-name" :class="`${textColor(color(user.userId!))} truncate font-semibold ~text-label-min/label-max`">
											{{ inputValue }}
										</span>
										<span class="~text-label-small-min/label-small-max">|</span>
										<span class="~text-label-small-min/label-small-max">{{ time }}</span>
									</div>
									<P>{{ t('onboarding.message_example_text') }}</P>
								</div>
							</div>
						</div>
					</div>

					<!-- Next Button -->
					<div class="flex w-full justify-end">
						<Button @click="nextStep" :disabled="!isUsernameChanged" class="w-fit">
							{{ t('forms.next') }}
						</Button>
					</div>
				</div>

				<!-- Step 2: Consent -->
				<div v-if="step === 2" class="flex h-full flex-col gap-8 pb-4">
					<!-- House Rules -->
					<div class="flex h-full flex-col gap-2">
						<H1>{{ t('onboarding.house_rules', [hubName]) }}</H1>
						<P class="h-full overflow-y-auto whitespace-pre-line break-all rounded-3xl bg-surface-low p-4">
							{{ consentText }}
						</P>
					</div>

					<!-- Consent Checkbox -->
					<div class="flex items-center gap-2">
						<Checkbox v-model="hasAgreed" />
						<span>{{ t('onboarding.consent_text') }}</span>
					</div>

					<!-- Buttons -->
					<div class="flex gap-4" :class="isConsentOnly ? 'justify-end' : 'justify-between'">
						<Button v-if="!isConsentOnly" @click="prevStep" color="text" class="w-fit px-0 text-on-surface-variant">
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
		<div v-else class="overflow-none relative flex h-full max-h-screen w-full items-center justify-center">
			<div class="relative flex aspect-square h-auto max-h-full w-3/4 rounded-3xl shadow xl:aspect-[3/2] xl:h-2/3 xl:w-auto">
				<!-- Step 1 -->
				<div v-if="step === 1" class="flex h-full w-full overflow-hidden rounded-3xl bg-surface-low">
					<!-- Left Image -->
					<div class="flex h-full w-1/2 flex-col overflow-y-auto ~gap-4/8">
						<figure class="h-full w-full">
							<img alt="Placeholder" :src="onboardingPlaceholder" class="h-full w-full object-cover" />
						</figure>
					</div>

					<!-- Right Form -->
					<div class="flex h-full w-1/2 flex-col bg-surface ~gap-4/8 ~px-4/24 ~py-24/36">
						<div class="flex flex-col ~gap-1/2">
							<H1>{{ t('onboarding.welcome', [hubName]) }}</H1>
							<P>{{ t('onboarding.welcome_description') }}</P>
						</div>

						<div class="flex flex-col ~gap-1/2">
							<H2>{{ t('onboarding.username_label') }}</H2>
							<P>{{ t('onboarding.username_description') }}</P>
							<div class="flex ~gap-2/4">
								<TextInput v-model="inputValue" :placeholder="pseudonym" class="h-10 !placeholder-on-surface-dim ~text-label-min/label-max" />
								<Button @click="fileInput!.click()">
									<Icon type="image_add" :filled="true" />
								</Button>
								<input ref="fileInput" type="file" accept="image/*" class="hidden" @change="handleFileUpload" />
							</div>
							<p class="italic text-on-surface-variant">
								{{ t('onboarding.username_disclaimer') }}
							</p>
						</div>

						<!-- Message Preview -->
						<div v-if="isUsernameChanged" class="flex flex-col ~gap-1/2">
							<P>{{ t('onboarding.message_example') }}</P>
							<div class="w--full flex items-center rounded-xl bg-background ~gap-4/8 ~p-3/6 xl:w-1/2">
								<div class="flex aspect-square h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full" :class="textColor(color(user.userId!))">
									<img v-if="avatarPreviewUrl" data-testid="avatar" :src="avatarPreviewUrl" class="h-full w-full" />
									<Icon v-else size="lg" type="person" />
								</div>
								<div class="flex flex-col ~gap-1/2">
									<div class="flex items-center ~gap-1/2">
										<span v-if="inputValue" data-testid="display-name" :class="`${textColor(color(user.userId!))} truncate font-semibold ~text-label-min/label-max`">
											{{ inputValue }}
										</span>
										<span class="~text-label-small-min/label-small-max">|</span>
										<span class="~text-label-small-min/label-small-max">{{ time }}</span>
									</div>
									<P>{{ t('onboarding.message_example_text') }}</P>
								</div>
							</div>
						</div>

						<Button @click="nextStep" :disabled="!isUsernameChanged" class="w-fit">
							{{ t('forms.next') }}
						</Button>
					</div>
				</div>

				<!-- Step 2 -->
				<div v-if="step === 2" class="flex h-full w-full overflow-hidden rounded-3xl bg-surface-low">
					<!-- Left Rules -->
					<div class="flex h-full w-1/2 flex-col overflow-y-auto ~gap-4/8 ~px-4/24 ~pt-24/36">
						<H1>{{ t('onboarding.house_rules', [hubName]) }}</H1>
						<P class="w-full overflow-y-auto whitespace-pre-line break-words">
							{{ consentText }}
						</P>
					</div>

					<!-- Right Consent -->
					<div class="flex h-full w-1/2 flex-col bg-surface ~gap-4/8 ~px-4/24 ~py-24/36">
						<Button v-if="!isConsentOnly" @click="prevStep" color="text" class="w-fit px-0 text-on-surface-variant">
							{{ t('forms.back') }}
						</Button>
						<div class="flex flex-col ~gap-1/2">
							<H1>{{ isConsentOnly ? t('onboarding.welcome_consent') : t('onboarding.welcome', [hubName]) }}</H1>
							<P>{{ isConsentOnly ? t('onboarding.welcome_consent_description') : t('onboarding.welcome_description') }}</P>
						</div>
						<div class="flex items-center ~gap-2/4">
							<Checkbox v-model="hasAgreed" />
							<span>{{ t('onboarding.consent_text') }}</span>
						</div>
						<Button :disabled="submitted || !hasAgreed" class="w-fit" @click="submit">
							{{ t('onboarding.enter_hub') }}
						</Button>
					</div>
				</div>

				<!-- Mascot -->
				<figure class="absolute -bottom-4 -right-16 hidden w-64 lg:block xl:-right-32 xl:w-auto">
					<img alt="PubHubs mascotte" :src="mascotteImage" />
				</figure>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	// External imports
	import { computed, onBeforeMount, ref } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { useRouter, useRoute } from 'vue-router';

	// Assets
	import onboardingPlaceholder from '../../public/img/onboarding_placeholder.svg';
	import mascotteImage from '../../public/img/mascotte.svg';

	// Components
	import Button from '@/components/elements/Button.vue';
	import H1 from '@/components/elements/H1.vue';
	import H2 from '@/components/elements/H2.vue';
	import Icon from '@/components/elements/Icon.vue';
	import P from '@/components/elements/P.vue';
	import Checkbox from '@/components/forms/Checkbox.vue';
	import TextInput from '@/components/forms/TextInput.vue';
	import HubBanner from '@/components/ui/HubBanner.vue';
	import HubIcon from '@/components/ui/HubIcon.vue';

	// Log
	import { fileUpload } from '@/logic/composables/fileUpload';
	import { useMatrixFiles } from '@/logic/composables/useMatrixFiles';
	import { useUserColor } from '@/logic/composables/useUserColor';
	import { usePubHubs } from '@/logic/core/pubhubsStore';
	import { useHubSettings } from '@/logic/store/hub-settings';
	import { useSettings } from '@/logic/store/settings';
	import { useUser } from '@/logic/store/user';

	// Setup
	const { t } = useI18n();
	const router = useRouter();
	const route = useRoute();

	const pubhubs = usePubHubs();
	const user = useUser();
	const hubSettings = useHubSettings();
	const settings = useSettings();

	const hubName = ref(hubSettings.hubName);
	const isMobile = computed(() => settings.isMobileState);

	const inputValue = ref('');
	const pseudonym = ref(user.user.userId.split(':')[0].substring(1));
	const isUsernameChanged = computed(() => inputValue.value !== '');

	const isConsentOnly = computed(() => route.query.type === 'consent');
	console.log(isConsentOnly.value);
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
			await fileUpload(errorMsg, accessToken, uploadUrl, imageTypes, syntheticEvent, (mxUrl) => {
				avatarMxcUrl.value = mxUrl;
				if (avatarMxcUrl.value) {
					user.setAvatarMxcUrl(avatarMxcUrl.value, true);
				}
			});
		} catch (error) {
			console.error('Error uploading avatar:', error);
		}
	};

	// Consent handling
	const hasAgreed = ref(false);
	const consentVersion = ref(0);
	const consentText = ref('');

	const loadHubSettings = async () => {
		const hubSettingsJSON = await hubSettings.getHubJSON();

		if (hubSettingsJSON !== undefined) {
			consentVersion.value = hubSettingsJSON.version;
			consentText.value = hubSettingsJSON.consent;
		}
	};

	// Submit
	const submitted = ref(false);

	const submit = async () => {
		try {
			if (isConsentOnly.value) {
				await user.setUserConsentVersion(consentVersion.value);
				router.push({ name: 'home' });
				return;
			}

			if (inputValue.value !== '') {
				await pubhubs.changeDisplayName(inputValue.value);
			}

			if (selectedAvatarFile.value) {
				await uploadAvatar();
			}

			await user.fetchIfUserNeedsConsent();
			await user.setUserConsentVersion(consentVersion.value);

			router.push({ name: 'home' });
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
