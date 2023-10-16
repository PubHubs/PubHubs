<template>
	<div class="flex flex-col h-screen bg-gray-100">
		<div class="h-20 pt-4 px-4 z-10 overflow-hidden bg-blue-500 text-white">
			<h1 class="mt-4 text-2xl">{{ $t('settings.title') }}</h1>
		</div>
		<line class="m-4 mb-4"></line>
		<div class="px-4">
			<form @submit.prevent>
				<div class="flex flex-col items-center mb-4">
					<Avatar :class="bgColor(color(user.user.userId))" :img="avatarUrl" class="w-32 h-32 rounded-full"></Avatar>
					<label for="avatar" class="mt-2 font-semibold text-gray-700 cursor-pointer hover:underline"> Change Avatar </label>
					<input type="file" id="avatar" accept="image/png, image/jpeg, image/svg" class="hidden" ref="file" @change="submitFile($event)" />
				</div>

				<div class="flex flex-row mb-4 items-center">
					<label class="w-2/6 font-semibold text-gray-700">{{ $t('settings.displayname') }}</label>
					<TextInput
						class="w-4/6 p-1 border rounded focus:outline-none focus:border-blue-500"
						name="displayname"
						v-model="data.displayName.value"
						:placeholder="user.user.displayName"
						@changed="updateData('displayName', $event)"
						@submit="submit"
					></TextInput>
				</div>

				<div class="flex flex-row">
					<Button @click.prevent="submit()" :disabled="!isValidated()" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-700 transition duration-300 ease-in-out">{{ $t('forms.submit') }}</Button>
				</div>
			</form>
			<div v-if="message != ''" class="rounded-lg bg-red-200 p-2 mt-2 text-red-700">{{ message }}</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { ref, onMounted } from 'vue';
	import { useUser } from '@/store/store';
	import { useI18n } from 'vue-i18n';
	import { useFormState } from '@/composables/useFormState';
	import { photoUpload } from '@/composables/photoUpload';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { useUserColor } from '@/composables/useUserColor';

	const user = useUser();
	const { t } = useI18n();
	const { data, setData, updateData, dataIsChanged, isValidated, message, setMessage } = useFormState();
	const pubhubs = usePubHubs();
	const { color, bgColor } = useUserColor();

	const avatarUrl = ref('');

	setData({
		displayName: {
			value: '',
			validation: { required: true },
		},
	});

	function submit() {
		if (isValidated()) {
			if (dataIsChanged('displayName')) {
				pubhubs.changeDisplayName(data.displayName.value as string);
				setMessage(t('settings.displayname_changed', [data.displayName.value]));
				updateData('displayName', '');
			}
		}
	}

	onMounted(async () => {
		avatarUrl.value = await pubhubs.getAvatarUrl();
		avatarUrl.value = pubhubs.getBaseUrl + '/_matrix/media/r0/download/' + avatarUrl.value.slice(6);
	});

	async function submitFile(event: Event) {
		const url = pubhubs.getBaseUrl + '/_matrix/media/r0/upload';
		const token = pubhubs.Auth.getAccessToken();
		photoUpload(url, token, event, (uri) => {
			// Update the avatar URL immediately
			avatarUrl.value = pubhubs.getBaseUrl + '/_matrix/media/r0/download/' + uri.slice(6);
			pubhubs.changeAvatar(uri);
			setMessage(t('settings.avatar_changed'));
		});
	}
</script>
