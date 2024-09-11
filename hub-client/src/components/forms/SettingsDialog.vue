<template>
	<Dialog :title="$t('settings.title')" :buttons="buttonsSubmitCancel" @close="dialogAction($event)">
		<form @submit.prevent>
			<div class="flex flex-col items-center md:items-start md:flex-row mb-4">
				<label class="md:w-2/6 font-semibold text-gray">{{ $t('settings.avatar') }}</label>
				<input type="file" id="avatar" accept="image/png, image/jpeg, image/svg" class="hidden" ref="file" @change="uploadAvatar($event)" />

				<div class="md:w-4/6 flex flex-col md:flex-row justify-between">
					<Avatar :class="bgColor(color(user.user.userId))" :userId="user.user.userId" :img="data.avatarUrl.value" class="w-32 h-32 rounded-full"></Avatar>

					<div class="flex justify-center md:justify-normal md:flex-col md:space-y-4 mt-5 md:mr-3">
						<label for="avatar">
							<Icon size="lg" type="edit" class="group-hover:block cursor-pointer"></Icon>
						</label>
						<Icon size="lg" type="bin" class="group-hover:block cursor-pointer" @click="removeAvatar"></Icon>
					</div>
				</div>
			</div>
			<div class="flex flex-col md:flex-row mb-4">
				<label class="w-2/6 font-semibold text-gray">{{ $t('settings.displayname') }}</label>
				<TextInput
					class="md:w-4/6 p-1 border rounded focus:outline-none focus:border-blue-500"
					name="displayname"
					v-model.trim="data.displayName.value"
					:placeholder="$t('settings.displayname')"
					@changed="updateData('displayName', $event)"
				></TextInput>
			</div>
			<div class="flex flex-col md:flex-row mb-4">
				<label class="w-2/6 font-semibold text-gray">{{ $t('settings.userId') }}</label>
				<div title="Hub specific User ID" class="md:w-4/6 p-1 text-gray-light italic text-lg">{{ user.user.userId }}</div>
			</div>
		</form>

		<ValidationErrors :errors="validationErrors"></ValidationErrors>

		<div v-if="message !== ''" class="rounded-lg bg-green-dark text-white p-2 mt-2">{{ message }}</div>
	</Dialog>
</template>

<script setup lang="ts">
	import { onMounted } from 'vue';
	import { useUser, useSettings, useDialog, buttonsSubmitCancel, DialogSubmit, DialogButtonAction } from '@/store/store';
	import { useI18n } from 'vue-i18n';
	import { FormDataType, useFormState } from '@/composables/useFormState';
	import { fileUpload } from '@/composables/fileUpload';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { useUserColor } from '@/composables/useUserColor';
	import { useMatrixFiles } from '@/composables/useMatrixFiles';

	const { t } = useI18n();
	const user = useUser();
	const settings = useSettings();
	const dialog = useDialog();
	const { data, setSubmitButton, setData, updateData, dataIsChanged, message, setMessage, validationErrors } = useFormState();
	const pubhubs = usePubHubs();
	const { imageTypes, uploadUrl, downloadUrl } = useMatrixFiles(pubhubs);
	const { color, bgColor } = useUserColor();

	setData({
		displayName: {
			value: '',
			validation: { required: true, min_length: 2, max_length: settings.getDisplayNameMaxLength },
			show_validation: { required: false, max_length: true },
		},
		avatarUrl: {
			value: '',
			tmp: '',
		},
	});

	onMounted(() => {
		setSubmitButton(dialog.properties.buttons[0]);
	});

	onMounted(async () => {
		data.displayName.value = user.user.displayName as FormDataType;
		const url = await pubhubs.getAvatarUrl();
		if (url !== '') {
			setData({
				avatarUrl: {
					value: downloadUrl + url.slice(6),
					tmp: '',
				},
			});
		}
	});

	function dialogAction(action: DialogButtonAction) {
		if (action === DialogSubmit) {
			submit();
		}
	}

	async function submit() {
		if (dataIsChanged('displayName')) {
			const newDisplayName = data.displayName.value as string;
			await pubhubs.changeDisplayName(newDisplayName);
			setMessage(t('settings.displayname_changed', [newDisplayName]));
			updateData('displayName', '');
		}
		if (dataIsChanged('avatarUrl')) {
			user.userAvatarUrl = data.avatarUrl.tmp;
			await pubhubs.changeAvatar(user.userAvatarUrl);
		}
	}

	// Display name and Avatar related functions

	async function uploadAvatar(event: Event) {
		const accessToken = pubhubs.Auth.getAccessToken();
		const errorMsg = t('errors.file_upload');
		await fileUpload(errorMsg, accessToken, uploadUrl, imageTypes, event, (uri) => {
			// Update the user store for avatar url to overcome synapse slow updates in user profile.
			data.avatarUrl.tmp = uri;
			// Update the form data i.e., there is a change and submit button is enabled.
			updateData('avatarUrl', downloadUrl + uri.slice(6));
		});
	}

	async function removeAvatar() {
		// Update the user store for avatar url to overcome synapse slow updates in user profile.
		data.avatarUrl.tmp = '';

		// Update the form data i.e., there is a change and submit button is enabled.
		updateData('avatarUrl', '');
	}
</script>
