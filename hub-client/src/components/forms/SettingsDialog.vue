<template>
	<Dialog
		:buttons="buttonsSubmitCancel"
		:title="$t('settings.profile_title')"
		width="w-full md:w-1/2 2xl:w-2/6"
		@close="dialogAction($event)"
	>
		<form @submit.prevent="submit">
			<div class="mb-4 flex flex-col md:flex-row md:items-start">
				<label class="text-gray w-2/6 shrink-0 pt-1 font-semibold">{{ $t('settings.avatar') }}</label>
				<input
					ref="fileInput"
					accept="image/png, image/jpeg, image/svg"
					class="hidden"
					type="file"
					@change="chooseAvatar($event)"
				/>
				<div class="flex items-center gap-4">
					<Avatar
						:avatar-url="blobUrl?.url"
						class="outline-surface-elevated h-800 w-800 rounded-full outline-3"
					/>
					<div class="flex gap-3">
						<button
							type="button"
							class="hover:text-on-surface-dim cursor-pointer"
							:aria-label="$t('settings.change_avatar')"
							@click="fileInput?.click()"
						>
							<Icon
								data-testid="change-avatar"
								type="pencil-simple"
							/>
						</button>
						<button
							type="button"
							class="hover:text-accent-error cursor-pointer"
							:aria-label="$t('settings.remove_avatar')"
							@click="removeAvatar"
						>
							<Icon
								data-testid="remove-avatar"
								type="trash"
							/>
						</button>
					</div>
				</div>
			</div>

			<div class="mb-4 flex flex-col md:flex-row md:items-start">
				<label
					for="displayname"
					class="text-gray w-2/6 shrink-0 pt-1 font-semibold"
					>{{ $t('settings.displayname') }}</label
				>
				<TextField
					id="displayname"
					v-model.trim="formState.data.displayName.value as string"
					data-testid="change-displayname"
					name="displayname"
					:placeholder="$t('settings.displayname')"
					show-length
					:validation="{ minLength: 3, maxLength: settings.getDisplayNameMaxLength }"
				/>
			</div>

			<div class="mb-4 flex flex-col md:flex-row md:items-start">
				<label class="text-gray w-2/6 shrink-0 pt-1 font-semibold">{{ $t('settings.userId') }}</label>
				<div
					class="text-on-surface-dim text-body p-1 text-lg italic"
					:title="$t('settings.userId_description')"
				>
					{{ user.userId }}
				</div>
			</div>

			<div
				v-if="formState.message.value !== ''"
				class="bg-green-dark mt-2 rounded-lg p-2 text-white"
			>
				{{ formState.message }}
			</div>
		</form>
	</Dialog>
</template>

<script lang="ts" setup>
	// Packages
	import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import TextField from '@hub-client/components/forms/elements/TextField.vue';
	import Avatar from '@hub-client/components/ui/Avatar.vue';
	import Dialog from '@hub-client/components/ui/Dialog.vue';

	// Composables
	import { fileUpload } from '@hub-client/composables/fileUpload';
	import { useFormState } from '@hub-client/composables/useFormState';
	import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';

	// Logic
	import { BlobManager } from '@hub-client/logic/core/blobManager';
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
	const fileInput = ref<HTMLInputElement>();
	const fileInfo = ref<File>();

	const avatarMxcUrl = ref<string | undefined>(undefined);
	const blobUrl = ref<BlobManager>();

	formState.setData({
		displayName: {
			value: user.userDisplayName(user.userId ?? '') ?? '',
		},
	});

	watch(
		() => formState.data.displayName.value,
		(newValue) => {
			formState.updateData('displayName', newValue);
		},
	);

	onMounted(() => {
		formState.setSubmitButton(getSubmitButton());
		formState.data.displayName.value = user.userDisplayName(user.userId ?? '') ?? '';
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
		} else if (avatarMxcUrl.value !== undefined) {
			user.setAvatarUrl(avatarMxcUrl.value);
		}
	}

	async function chooseAvatar(event: Event) {
		getSubmitButton().enabled = true;
		const target = event.currentTarget as HTMLInputElement;
		const file = target.files && target.files[0];
		if (file) {
			fileInfo.value = file;
			blobUrl.value?.revoke();
			blobUrl.value = new BlobManager(file);
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
		blobUrl.value = new BlobManager(undefined);
		fileInfo.value = undefined;
		getSubmitButton().enabled = true;
	}
</script>
