<template>
	<Dialog :title="$t('settings.title')" :buttons="buttonsSubmitCancel" width="w-1/3" @close="dialogAction($event)">
		<form @submit.prevent>
			<div class="flex flex-row mb-4">
				<label class="w-2/6 font-semibold text-gray-700">{{ $t('settings.avatar') }}</label>
				<input type="file" id="avatar" accept="image/png, image/jpeg, image/svg" class="hidden" ref="file" @change="uploadAvatar($event)" />

				<div class="w-4/6 flex justify-between">
					<Avatar :class="bgColor(color(user.user.userId))" :userId="user.user.userId" :img="data.avatarUrl.value" class="w-32 h-32 rounded-full"></Avatar>

					<div class="flex flex-col space-y-4 mt-5 mr-3">
						<label for="avatar">
							<Icon size="lg" type="edit" class="group-hover:block cursor-pointer"></Icon>
						</label>
						<Icon size="lg" type="bin" class="group-hover:block cursor-pointer" @click="removeAvatar"></Icon>
					</div>
				</div>
			</div>

			<div class="flex flex-row mb-4">
				<label class="w-2/6 font-semibold text-gray-700">{{ $t('settings.displayname') }}</label>
				<TextInput
					class="w-4/6 p-1 border rounded focus:outline-none focus:border-blue-500"
					name="displayname"
					v-model.trim="data.displayName.value"
					:placeholder="$t('settings.displayname')"
					@changed="updateData('displayName', $event)"
				></TextInput>
			</div>
		</form>

		<ValidationErrors :errors="validationErrors"></ValidationErrors>

		<div v-if="message != ''" class="rounded-lg bg-green-dark text-white p-2 mt-2">{{ message }}</div>
	</Dialog>
</template>

<script setup lang="ts">
	import { onMounted } from 'vue';
	import { useUser, useSettings, useDialog, buttonsSubmitCancel, DialogSubmit, DialogButtonAction } from '@/store/store';
	import { useI18n } from 'vue-i18n';
	import { useFormState } from '@/composables/useFormState';
	import { fileUpload } from '@/composables/fileUpload';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { useUserColor } from '@/composables/useUserColor';
	import { useMatrixFiles } from '@/composables/useMatrixFiles';
	import { MatrixClient } from 'matrix-js-sdk';

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
		await user.fetchDisplayName(pubhubs.client as MatrixClient);
		data.displayName.value = user.user.displayName as string;

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
			await pubhubs.changeAvatar(data.avatarUrl.tmp);
		}
	}

	async function uploadAvatar(event: Event) {
		const accessToken = pubhubs.Auth.getAccessToken();
		await fileUpload(accessToken, uploadUrl, imageTypes, event, (uri) => {
			data.avatarUrl.tmp = uri;
			updateData('avatarUrl', downloadUrl + uri.slice(6));
		});
	}

	async function removeAvatar() {
		data.avatarUrl.tmp = '';
		updateData('avatarUrl', '');
	}
</script>
