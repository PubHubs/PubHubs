<template>
	<Dialog :title="$t('settings.title')" :buttons="buttonsSubmitCancel" @close="dialogAction($event)">
		<form @submit.prevent>
			<div class="mb-4 flex flex-col items-center md:flex-row md:items-start">
				<label class="font-semibold text-gray md:w-2/6">{{ $t('settings.avatar') }}</label>
				<input type="file" id="avatar" accept="image/png, image/jpeg, image/svg" class="hidden" ref="file" @change="chooseAvatar($event)" />

				<div class="flex flex-col justify-between md:w-4/6 md:flex-row">
					<img :src="blobUrl" class="h-32 w-32 rounded-full" v-if="blobUrl" />
					<Avatar :img="blobUrl" class="h-32 w-32 rounded-full" v-else> </Avatar>

					<div class="mt-5 flex justify-center md:mr-3 md:flex-col md:justify-normal md:space-y-4">
						<label for="avatar">
							<Icon size="lg" type="edit" class="cursor-pointer group-hover:block"></Icon>
						</label>
						<Icon size="lg" type="bin" class="cursor-pointer group-hover:block" @click="removeAvatar"></Icon>
					</div>
				</div>
			</div>
			<div class="mb-4 flex flex-col md:flex-row">
				<label class="w-2/6 font-semibold text-gray">{{ $t('settings.displayname') }}</label>
				<TextInput
					class="focus:border-blue-500 rounded border p-1 focus:outline-none md:w-4/6"
					name="displayname"
					v-model.trim="formState.data.displayName.value"
					:placeholder="$t('settings.displayname')"
					@changed="formState.updateData('displayName', $event)"
				></TextInput>
			</div>
			<div class="mb-4 flex flex-col md:flex-row">
				<label class="w-2/6 font-semibold text-gray">{{ $t('settings.userId') }}</label>
				<div title="Hub specific User ID" class="p-1 text-lg italic text-gray-light md:w-4/6">{{ user.user.userId }}</div>
			</div>
		</form>

		<ValidationErrors :errors="formState.validationErrors.value"></ValidationErrors>

		<div v-if="formState.message.value !== ''" class="mt-2 rounded-lg bg-green-dark p-2 text-white">{{ formState.message }}</div>
	</Dialog>
</template>

<script setup lang="ts">
	import { fileUpload } from '@/logic/composables/fileUpload';
	import { FormDataType, useFormState } from '@/logic/composables/useFormState';
	import { useMatrixFiles } from '@/logic/composables/useMatrixFiles';
	import { usePubHubs } from '@/logic/core/pubhubsStore';
	import { useSettings } from '@/logic/store/settings';
	import { buttonsSubmitCancel, DialogButtonAction, DialogSubmit, useDialog } from '@/logic/store/store';
	import { useUser } from '@/logic/store/user';
	import { onMounted, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Dialog from '../ui/Dialog.vue';
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
	const fileInfo = ref<File>();

	let avatarMxcUrl = ref<string | undefined>(undefined);
	let blobUrl = ref<string | undefined>(undefined);

	formState.setData({
		displayName: {
			value: user.user.displayName as string,
			validation: { required: true, max_length: settings.getDisplayNameMaxLength, allow_empty_number: false, allow_empty_object: false, allow_empty_text: true },
			show_validation: { required: false, max_length: true },
		},
	});

	onMounted(() => {
		formState.setSubmitButton(getSubmitButton());
		formState.data.displayName.value = user.user.displayName as FormDataType;
		blobUrl.value = user.avatarUrl;
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
		if (fileInfo.value) {
			await uploadAvatar();
		}
		if (avatarMxcUrl.value !== undefined) {
			user.setAvatarMxcUrl(avatarMxcUrl.value, true);
		}
		if (blobUrl.value) {
			URL.revokeObjectURL(blobUrl.value);
		}
	}

	async function chooseAvatar(event: Event) {
		getSubmitButton().enabled = true;
		const target = event.currentTarget as HTMLInputElement;
		const file = target.files && target.files[0];
		if (file) {
			fileInfo.value = file;
			blobUrl.value = URL.createObjectURL(file);
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
					user.setAvatarMxcUrl(avatarMxcUrl.value, true);
				}
			});
		} else {
			console.error('Access Token is invalid for File upload.');
		}
	}

	async function removeAvatar() {
		avatarMxcUrl.value = '';
		if (blobUrl.value) {
			URL.revokeObjectURL(blobUrl.value);
		}
		blobUrl.value = undefined;
		getSubmitButton().enabled = true;
	}
</script>
