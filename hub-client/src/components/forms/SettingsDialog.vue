<template>
	<Dialog
		:buttons="buttonsSubmitCancel"
		:title="$t('settings.profile_title')"
		@close="dialogAction($event)"
	>
		<form @submit.prevent>
			<div class="mb-4 flex flex-col items-center md:flex-row md:items-start">
				<label class="text-gray font-semibold md:w-2/6">{{ $t('settings.avatar') }}</label>
				<input
					id="avatar"
					accept="image/png, image/jpeg, image/svg"
					class="hidden"
					type="file"
					@change="chooseAvatar($event)"
				/>

				<div class="flex flex-col justify-between md:w-4/6 md:flex-row">
					<Avatar
						:avatar-url="blobUrl?.url"
						class="h-32 w-32 rounded-full"
					/>

					<div class="mt-5 flex justify-center md:mr-3 md:flex-col md:justify-normal md:space-y-4">
						<label for="avatar">
							<Icon
								class="hover:text-on-surface-variant cursor-pointer group-hover:block"
								data-testid="change-avatar"
								size="lg"
								type="pencil-simple"
							/>
						</label>
						<Icon
							class="hover:text-on-surface-variant cursor-pointer group-hover:block"
							data-testid="remove-avatar"
							size="lg"
							type="trash"
							@click="removeAvatar"
						/>
					</div>
				</div>
			</div>
			<div class="mb-4 flex flex-col md:flex-row">
				<label class="text-gray w-2/6 font-semibold">{{ $t('settings.displayname') }}</label>
				<TextInput
					v-model.trim="formState.data.displayName.value as string"
					class="text-body rounded-xs border p-1 focus:border-blue-500 focus:outline-none md:w-4/6"
					name="displayname"
					:placeholder="$t('settings.displayname')"
					@changed="formState.updateData('displayName', $event)"
				/>
			</div>
			<div class="mb-4 flex flex-col md:flex-row">
				<label class="text-gray w-2/6 font-semibold">{{ $t('settings.userId') }}</label>
				<div
					class="text-on-surface-dim text-body p-1 text-lg italic md:w-4/6"
					title="Hub specific User ID"
				>
					{{ user.userId }}
				</div>
			</div>
		</form>

		<ValidationErrors :errors="formState.validationErrors.value" />

		<div
			v-if="formState.message.value !== ''"
			class="bg-green-dark mt-2 rounded-lg p-2 text-white"
		>
			{{ formState.message }}
		</div>
	</Dialog>
</template>

<script lang="ts" setup>
	// Packages
	import { onBeforeUnmount, onMounted, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import TextInput from '@hub-client/components/forms/TextInput.vue';
	import ValidationErrors from '@hub-client/components/forms/ValidationErrors.vue';
	import Avatar from '@hub-client/components/ui/Avatar.vue';
	import Dialog from '@hub-client/components/ui/Dialog.vue';

	// Composables
	import { fileUpload } from '@hub-client/composables/fileUpload';
	import { type FormDataType, useFormState } from '@hub-client/composables/useFormState';
	import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';

	import { BlobManager } from '@hub-client/logic/core/blobManager';
	// Logic
	import { createLogger } from '@hub-client/logic/logging/Logger';

	// Stores
	import { type DialogButtonAction, DialogSubmit, buttonsSubmitCancel, useDialog } from '@hub-client/stores/dialog';
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	const logger = createLogger('SettingsDialog');
	const { t } = useI18n();
	const user = useUser();
	const settings = useSettings();
	const dialog = useDialog();
	const formState = useFormState();
	const pubhubs = usePubhubsStore();
	const { imageTypes, uploadUrl } = useMatrixFiles();
	const fileInfo = ref<File>();

	let avatarMxcUrl = ref<string | undefined>(undefined);
	let blobUrl = ref<BlobManager>();

	formState.setData({
		displayName: {
			value: user.userDisplayName(user.userId ?? '') as string,
			validation: {
				required: true,
				max_length: settings.getDisplayNameMaxLength,
				allow_empty_number: false,
				allow_empty_object: false,
				allow_empty_text: true,
			},
			show_validation: { required: false, max_length: true },
		},
	});

	onMounted(() => {
		formState.setSubmitButton(getSubmitButton());
		formState.data.displayName.value = user.userDisplayName(user.userId ?? '') as FormDataType;
		blobUrl.value = new BlobManager(user.userAvatar(user.userId ?? ''));
	});

	onBeforeUnmount(() => {
		blobUrl.value?.revoke();
	});

	function dialogAction(action: DialogButtonAction) {
		if (action === DialogSubmit) {
			submit();
		}
	}

	function getSubmitButton() {
		return dialog.properties.buttons[0];
	}

	async function submit() {
		// This check enables empty values to be submitted since dataIsChanged() method can't handle empty values conditional cal.
		if (formState.dataIsChanged('displayName')) {
			const newDisplayName = formState.data.displayName.value as string;
			await user.setDisplayName(newDisplayName);
			formState.setMessage(t('settings.displayname_changed', [newDisplayName]));
			formState.updateData('displayName', newDisplayName);
		}
		if (fileInfo.value) {
			await uploadAvatar();
		}
		if (avatarMxcUrl.value !== undefined) {
			user.setAvatarUrl(avatarMxcUrl.value);
		}
		blobUrl.value?.revoke();
	}

	async function chooseAvatar(event: Event) {
		getSubmitButton().enabled = true;
		const target = event.currentTarget as HTMLInputElement;
		const file = target.files && target.files[0];
		if (file) {
			fileInfo.value = file;
			blobUrl.value?.create(file);
		}
	}

	// Avatar related functions
	async function uploadAvatar() {
		const accessToken = pubhubs.Auth.getAccessToken();
		const syntheticEvent = {
			currentTarget: {
				files: [fileInfo.value],
			},
		} as unknown as Event;
		if (accessToken) {
			const errorMsg = t('errors.file_upload');
			fileUpload(errorMsg, accessToken, uploadUrl, imageTypes, syntheticEvent, (mxUrl) => {
				avatarMxcUrl.value = mxUrl;
				if (avatarMxcUrl.value !== undefined) {
					user.setAvatarUrl(avatarMxcUrl.value);
				}
			});
		} else {
			logger.error('Access Token is invalid for File upload.');
		}
	}

	async function removeAvatar() {
		avatarMxcUrl.value = '';
		blobUrl.value?.revoke();
		blobUrl.value = undefined;
		fileInfo.value = undefined;
		getSubmitButton().enabled = true;
	}
</script>
