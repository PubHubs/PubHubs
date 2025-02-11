<template>
	<Dialog :title="$t('settings.title')" :buttons="buttonsSubmitCancel" @close="dialogAction($event)">
		<form @submit.prevent>
			<div class="flex flex-col items-center md:items-start md:flex-row mb-4">
				<label class="md:w-2/6 font-semibold text-gray">{{ $t('settings.avatar') }}</label>
				<input type="file" id="avatar" accept="image/png, image/jpeg, image/svg" class="hidden" ref="file" @change="uploadAvatar($event)" />

				<div class="md:w-4/6 flex flex-col md:flex-row justify-between">
					<Avatar :user="user" :overrideAvatarUrl="avatarUrl" class="w-32 h-32 rounded-full"></Avatar>

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
					v-model.trim="formState.data.displayName.value"
					:placeholder="$t('settings.displayname')"
					@changed="formState.updateData('displayName', $event)"
				></TextInput>
			</div>
			<div class="flex flex-col md:flex-row mb-4">
				<label class="w-2/6 font-semibold text-gray">{{ $t('settings.userId') }}</label>
				<div title="Hub specific User ID" class="md:w-4/6 p-1 text-gray-light italic text-lg">{{ user.user.userId }}</div>
			</div>
		</form>

		<ValidationErrors :errors="formState.validationErrors.value"></ValidationErrors>

		<div v-if="formState.message.value !== ''" class="rounded-lg bg-green-dark text-white p-2 mt-2">{{ formState.message }}</div>
	</Dialog>
</template>

<script setup lang="ts">
	import { fileUpload } from '@/composables/fileUpload';
	import { FormDataType, useFormState } from '@/composables/useFormState';
	import { useMatrixFiles } from '@/composables/useMatrixFiles';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { useSettings } from '@/store/settings';
	import { buttonsSubmitCancel, DialogButtonAction, DialogSubmit, useDialog } from '@/store/store';
	import { useUser } from '@/store/user';
	import { onMounted, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Dialog from '../ui/Dialog.vue';
	import Avatar from '../ui/Avatar.vue';
	import Icon from '../elements/Icon.vue';
	import TextInput from './TextInput.vue';
	import ValidationErrors from './ValidationErrors.vue';

	const { t } = useI18n();
	const user = useUser();
	const settings = useSettings();
	const dialog = useDialog();
	const formState = useFormState();
	const pubhubs = usePubHubs();
	const { imageTypes, uploadUrl } = useMatrixFiles();

	let avatarMxcUrl = ref<string | undefined>(undefined);
	let avatarUrl = ref<string | undefined>(undefined);

	watch(avatarMxcUrl, updateAvatarUrl);

	formState.setData({
		displayName: {
			value: user.user.displayName as string,
			validation: { required: true, max_length: settings.getDisplayNameMaxLength, allow_empty_number: false, allow_empty_object: false, allow_empty_text: true },
			show_validation: { required: false, max_length: true },
		},
	});

	onMounted(() => {
		formState.setSubmitButton(getSubmitButton());
	});

	onMounted(() => {
		formState.data.displayName.value = user.user.displayName as FormDataType;
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
			await pubhubs.changeDisplayName(newDisplayName);
			formState.setMessage(t('settings.displayname_changed', [newDisplayName]));
			formState.updateData('displayName', newDisplayName);
		}

		if (avatarMxcUrl.value !== undefined) {
			user.setAvatarMxcUrl(avatarMxcUrl.value, true);
		}
	}

	function updateAvatarUrl(): void {
		avatarUrl.value = avatarMxcUrl.value;
	}

	// Avatar related functions
	async function uploadAvatar(event: Event) {
		const accessToken = pubhubs.Auth.getAccessToken();
		if (accessToken) {
			const errorMsg = t('errors.file_upload');
			await fileUpload(errorMsg, accessToken, uploadUrl, imageTypes, event, (mxUrl) => {
				avatarMxcUrl.value = mxUrl;
				getSubmitButton().enabled = true;
			});
		} else {
			console.error('Access Token is invalid for File upload.');
		}
	}

	async function removeAvatar() {
		avatarMxcUrl.value = '';
		getSubmitButton().enabled = true;
	}
</script>
